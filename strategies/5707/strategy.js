/*
 * @coinsori-strategy v1
 * name: SOL Donchian 55/20 Breakout 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ledger shows the Donchian 55/20 breakout is the most
 * consistently validated family in this job — positive on BTC 1d and on SOL/ETH 4h
 * walk-forward windows. The idea: a close above the 55-bar high marks a genuine
 * trend start, not noise; a close below the 20-bar low ends it. Letting winners run
 * with a wide ATR trail captures the big moves that pay for the small failed breakouts.
 * When it buys and sells: It buys when the previous close breaks above the 55-bar
 * high as of the bar before it (a genuine new high). It sells when the close falls
 * below the 20-bar low, or on a 2x-ATR trailing stop below the highest close since
 * entry, or a 25% disaster stop. Position size is set so that the 2x-ATR stop costs
 * only 2% of equity — a failed breakout is cheap, a successful one is not capped.
 * When it does NOT work: In a long choppy sideways range it buys every failed
 * breakout and stops out repeatedly — many small losses that add up. It always
 * gives back part of the top before the trail catches the reversal, and it lags
 * a straight-line melt-up if the entry is delayed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hi55 = ctx.high(55, 2); // 55-bar high BEFORE the last close, so a real new high
  const lo20 = ctx.low(20, 1);
  const atr = ctx.atr(14, 1);
  if (hi55 == null || lo20 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trail = peak - 2 * atr; // 2x ATR trail = the documented validated setting
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    ctx.watch([
      { side: 'sell', price: lo20, trigger: 'below', note: 'Donchian 20 low' },
      { side: 'sell', price: trail, trigger: 'below', note: '2 ATR trail' },
      { side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' }
    ]);
    if (price < lo20) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (price < trail) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (disaster != null && price < disaster) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  if (prevClose > hi55) {
    // Risk-based sizing: the 2xATR stop distance must cost only 2% of equity.
    const stopDist = 2 * atr;
    if (stopDist <= 0) return null;
    const riskBudget = 0.02 * ctx.cash;
    let qty = riskBudget / stopDist; // coins so that stopDist*coins = 2% of cash
    const maxQty = (0.95 * ctx.cash) / price; // never more than ~all-in
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
