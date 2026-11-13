/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends in long bursts; a close above a 20-bar high while the market is already above its 200-bar average usually continues, and a trailing stop rides the trend while cutting losers short.
 * When it buys and sells: buys when the last closed price closes above the high of the PRIOR 20 bars while price is above its 200-bar average; sells when price closes 3xATR below the highest high since entry, or closes below its 50-bar average.
 * When it does NOT work: in a flat chop the breakout is reversed immediately and the strategy takes repeated small trailing-stop losses; in a sudden crash the stop is hit at a loss, though the 3xATR distance caps how much.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  const hi20 = ctx.high(20, 2); // high of the 20 bars BEFORE the last closed bar — a close can break above it
  if (sma200 == null || sma50 == null || atr == null || hi20 == null) return null;

  if (ctx.position <= 0) {
    const trendUp = prevClose > sma200;
    ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: '20-bar high breakout', conds: [{ label: 'above SMA200', ok: trendUp }] }]);
    if (prevClose > hi20 && trendUp) {
      // risk 3% of cash per trade; stop sits 3xATR below entry (bigger than the old 1.5% — MDD headroom showed we can afford it)
      const qty = (ctx.cash * 0.03) / (3 * atr);
      const cap = (ctx.cash / ctx.price) * 0.98;
      ctx.state.hi = prevClose; // start trailing reference at entry
      return { side: 'buy', qty: Math.min(qty, cap) };
    }
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }

  // trailing high: ratchet up from CLOSED highs only, so live and backtest see the same value
  let hi = ctx.state.hi;
  if (hi == null) {
    hi = ctx.high(50, 1); // restart/seed holding: init from recent closed highs
    if (hi == null) { ctx.watch([]); return null; }
  }
  const prevHigh = ctx.highs.at(-2);
  if (prevHigh != null) hi = Math.max(hi, prevHigh);
  ctx.state.hi = hi;

  const trailStop = hi - 3 * atr; // 3xATR: wide enough to survive noise, tight enough to lock in trend gains
  const trendExit = prevClose < sma50;
  ctx.watch([
    { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing stop' },
    { side: 'sell', price: sma50, trigger: 'below', note: 'trend broken' }
  ]);
  if (prevClose <= trailStop || trendExit) {
    ctx.state.hi = null;
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
