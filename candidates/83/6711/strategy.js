/*
 * @coinsori-strategy v1
 * name: BTC 4H Dip-Buy Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Mean reversion on the 4h chart: buy oversold dips only while BTC is in an
 * established uptrend, then sell when the dip reverts. Skips falling knives.
 * When it buys: close above the 200-bar SMA, price below the lower Bollinger
 * band (20,2) and RSI(14) below 30.
 * When it sells: RSI recovers above 55, close returns above the 20-bar SMA,
 * or a hard stop 2.5x ATR below entry.
 * When it does NOT work: strong bear markets (the uptrend filter keeps us out
 * but costs the early trend) and low-volatility chop where RSI never reaches 30.
 */

function onUpdate(ctx) {
  // All reads on closed bars (ago=1) so backtest, paper and live agree.
  const sma200 = ctx.sma(200, 1);
  const sma20  = ctx.sma(20, 1);
  const rsi    = ctx.rsi(14, 1);
  const atr    = ctx.atr(14, 1);
  const bb     = ctx.bb(20, 2, 1);
  if (sma200 == null || sma20 == null || rsi == null || atr == null || bb == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const inUptrend = prevClose > sma200;

  // Volatility guard: never buy into an extreme macro fear spike (VIX > 40) —
  // those are knife-catching moments, not reversion opportunities.
  const vix = ctx.data('base_vix');
  const vixOk = vix == null || vix < 40;

  // Hard stop 2.5x ATR below the fill price (2.5 = wide enough to breathe, tight enough to cut).
  let stopPx = null;
  if (ctx.position > 0 && ctx.entryPx != null) {
    stopPx = ctx.entryPx - 2.5 * atr;
  }

  // --- exits ---
  if (ctx.position > 0) {
    if (stopPx != null && price <= stopPx) {
      ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'hard stop 2.5x ATR' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    // Dip has reverted: RSI back above 55 or close back above the 20-bar SMA.
    if (rsi > 55 || prevClose > sma20) {
      ctx.watch([{ side:'sell', price: sma20, trigger:'above', note:'dip reverted' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
  }

  // --- entry: oversold dip inside an uptrend ---
  if (ctx.position <= 0 && inUptrend && prevClose < bb.lower && rsi < 30 && vixOk) {
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch([{
      side:'buy', price: bb.lower, trigger:'below', note:'BB lower oversold dip',
      conds:[
        { label:'RSI(14)', now: rsi, op:'<', ref:30, closed:true },
        { label:'close > SMA200', ok: inUptrend, closed:true }
      ]
    }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
