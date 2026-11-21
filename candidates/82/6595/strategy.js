/*
 * @coinsori-strategy v1
 * name: BTC 4h RSI Dip-Buy + Trailing Ride
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Instead of chasing momentum, it buys sharp dips (RSI below 30) that
 * happen inside an uptrend (EMA50 above EMA200) and then RIDES the recovery with a wide
 * trailing stop. The contrarian entry gets a good price after a panic; the 15% give-back
 * trailing stop locks in the gains of the recovery leg and lets strong bull legs run
 * almost to the top. This is a different return source than trend-following entries:
 * it profits from the bounce after fear, not from the trend itself.
 * When it buys: RSI(14) below 30 on a closed bar while EMA50 is above EMA200, and at
 * least 10 bars (about 1.5 days) since the last exit.
 * When it sells: price falls 15% below the highest price since entry (trailing stop), or
 * EMA50 falls below EMA200 (the uptrend is over).
 * When it does NOT work: in a long grinding bear market EMA50 stays below EMA200 so it
 * never buys (it misses the short-covering bounces); in a choppy range RSI dips below 30
 * often and each dip can stop out at -15%, stacking small losses.
 */

function onUpdate(ctx) {
  const rsi = ctx.rsi(14, 1);
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (rsi == null || e50 == null || e200 == null) return null;
  const price = ctx.price;
  const inPos = ctx.position > 0;
  const up = e50 > e200;

  // trailing high since entry (survives restarts via ctx.state)
  let high = ctx.state.high;
  if (inPos) {
    high = high == null ? price : Math.max(high, price);
    ctx.state.high = high;
  }
  // 15% give-back from the running high: bigger than normal bull pullbacks (5-12%),
  // small enough to lock gains before a crash deepens
  const trailStop = high != null ? high * 0.85 : 0;
  const sinceExit = ctx.state.lastExitBar == null ? 1e9 : ctx.i - ctx.state.lastExitBar;
  const cooled = sinceExit >= 10; // wait ~1.5 days after an exit, don't re-buy the same falling knife

  ctx.watch([
    { side:'buy', price: price, trigger:'below', note:'RSI dip in uptrend', conds:[{label:'RSI(14)', now: rsi, op:'<', ref: 30, closed:true}, {label:'EMA50>EMA200', ok: up}] },
    ...(inPos ? [
      { side:'sell', price: trailStop, trigger:'below', note:'trailing stop' },
      { side:'sell', price: e200, trigger:'below', note:'trend flip' }
    ] : [])
  ]);

  if (inPos) {
    if (price <= trailStop || !up) {
      ctx.state.lastExitBar = ctx.i;
      ctx.state.high = null;
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  if (up && rsi < 30 && cooled && ctx.cash > 0) {
    ctx.state.high = price;
    const qty = (ctx.cash / price) * 0.95;
    return { side:'buy', qty: qty };
  }
  return null;
}
