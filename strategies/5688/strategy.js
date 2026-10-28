/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/20 Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends strongly for extended periods, and Donchian-channel breakouts are a classic way to ride those trends while a hard stop caps the damage when a breakout fails.
 * When it buys and sells: It buys when the previous day's close breaks above the highest high of the 55 days before it, and sells when the close falls below the lowest low of the last 20 days or a 2xATR trailing stop / 25% disaster stop is hit.
 * When it does NOT work: In a sideways / choppy market with no persistent trend, breakouts frequently fail and the strategy churns through small losses. It also falls behind buy-and-hold during strong one-way bull runs when it exits early on pullbacks.
 */
function onUpdate(ctx) {
  const dc = ctx.donchian(55, 2);
  const dcExit = ctx.donchian(20, 1);
  const atr = ctx.atr(14, 1);
  if (dc == null || dcExit == null || atr == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Position sizing: risk 5% of cash per trade, stop at 2x ATR from entry
  const riskPerTrade = 0.05 * ctx.cash;
  const stopDist = 2 * atr;
  if (stopDist <= 0) return null;

  const inPos = ctx.position > 0;

  if (inPos) {
    // Trailing stop: 2x ATR below the highest close since entry
    const runHigh = Math.max(...ctx.closes.slice(-60));
    const trailStop = runHigh - 2 * atr;
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    let stop = Math.max(trailStop, hardStop != null ? hardStop : -Infinity);

    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing/hard stop' },
      { side: 'sell', price: dcExit.lower, trigger: 'below', note: 'Donchian20 exit' }
    ]);

    if (prevClose < dcExit.lower) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (prevClose < stop) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: dc.upper, trigger: 'above', note: 'Donchian55 breakout' }
  ]);
  if (prevClose > dc.upper) {
    const qty = riskPerTrade / stopDist;
    return { side: 'buy', qty: qty };
  }
  return null;
}
