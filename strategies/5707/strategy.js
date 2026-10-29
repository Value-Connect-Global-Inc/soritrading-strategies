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
 * below the 20-bar low, or on a 2.5-ATR trailing stop below the highest close since
 * entry, or a 25% disaster stop.
 * When it does NOT work: In a long choppy sideways range it buys every failed
 * breakout and stops out repeatedly — many small losses. It always gives back part
 * of the top before the trail catches the reversal, and it lags a straight-line
 * melt-up if the entry is delayed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Breakout level: highest high of the 55 bars BEFORE the last closed bar, so the
  // last close can actually exceed it (ago=2, not ago=1 which would include itself).
  const hi55 = ctx.high(55, 2);
  const lo20 = ctx.low(20, 1);
  const atr = ctx.atr(14, 1);
  if (hi55 == null || lo20 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // Trail: 2.5 ATR below the highest close since entry — let winners run, cut reversals.
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trail = peak - 2.5 * atr;
    const disaster = ctx.entryPx != null ? ctx.entryPx * 0.75 : null; // 25% disaster stop
    ctx.watch([
      { side: 'sell', price: lo20, trigger: 'below', note: 'Donchian 20 low' },
      { side: 'sell', price: trail, trigger: 'below', note: '2.5 ATR trail' },
      { side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' }
    ]);
    if (price < lo20) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (price < trail) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    if (disaster != null && price < disaster) { ctx.state.peak = null; return { side: 'sell', qty: pos, reduceOnly: true }; }
    return null;
  }

  // Entry: previous close broke above the 55-bar high of the window before it.
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  if (prevClose > hi55) {
    const qty = (0.95 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
