/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime EMA200 Pullback 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC spends long periods trending; the 200-bar EMA marks the regime.
 * We only buy when the trend is up, so we ride uptrends and sit out downtrends.
 * When it buys: price is above the 200 EMA (uptrend regime) and a pullback to
 * the 50 EMA has finished (price crosses back above the 50 EMA).
 * When it sells: close below the 200 EMA (trend broken), a trailing stop 3x ATR
 * below the highest close since entry, or a 6% hard stop.
 * When it does NOT work: long sideways chop where the 200 EMA is crossed back
 * and forth, and strong vertical rallies where being flat costs return vs holding.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const ema50_2 = ctx.ema(50, 2);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema50 == null || ema50_2 == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  if (prevClose == null || prevPrevClose == null) return null;

  // Track highest close since entry; survives restarts via ctx.state
  let trailHigh = ctx.state.trailHigh != null ? ctx.state.trailHigh : 0;
  if (pos > 0) {
    if (prevClose > trailHigh) trailHigh = prevClose;
    ctx.state.trailHigh = trailHigh;
  } else {
    ctx.state.trailHigh = 0;
  }

  const trailStop = trailHigh - atr * 3;
  const hardStop = ctx.entryPx != null ? ctx.entryPx * 0.94 : 0;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop 6%' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend break' }
    ]);
    if (price < trailStop || (hardStop > 0 && price < hardStop) || prevClose < ema200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: uptrend regime + completed pullback to the 50 EMA
  const uptrend = prevClose > ema200 && prevPrevClose > ema200;
  const pullbackDone = prevClose > ema50 && prevPrevClose <= ema50_2;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'pullback to EMA50 done', conds: [
    { label: 'close>EMA200', ok: uptrend, closed: true }
  ]}]);
  if (uptrend && pullbackDone) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
