/*
 * @coinsori-strategy v1
 * name: MultiAsset Donchian Breakout 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the classic turtle trend system — a new 20-day high is
 * the strongest single price signal that a sustained move has started. The
 * ledger shows a Donchian breakout was promising on BTC 1d (+240/+15 on two
 * disjoint windows), and this widens it to a 4-asset 4h basket (20 days = 120
 * 4h-bars) so a single asset's crash cannot sink the account. It is a
 * different trend mechanism (price-range breakout) from the EMA50/200 cross
 * core, giving the basket a second, uncorrelated way to catch trends.
 * When it buys and sells: on each asset, buy when price closes above the
 * highest high of the previous 120 bars (a 20-day breakout). Sell when price
 * closes below the lowest low of the previous 60 bars (a 10-day breakdown),
 * or when price falls 2.5 ATR below entry (hard stop). A 24-bar cooldown
 * after any exit prevents instant re-entry whipsaw.
 * When it does NOT work: in a long sideways range the 120-bar channel is
 * re-tested repeatedly and the stops turn small dips into realized losses;
 * it re-enters late in a V-shaped recovery and misses the first leg. Long-only
 * means a sustained bear market across all coins is flat-to-loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar channel extremes: a 120-bar high breakout = 20 days of 4h bars.
  const hi120 = ctx.high(120, 1);
  const lo60 = ctx.low(60, 1);
  const atr = ctx.atr(14, 1);
  if (hi120 == null || lo60 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    // 10-day low breakdown ends the trade; same 2.5-ATR hard stop as the core.
    if (price <= lo60 || price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: Math.max(lo60, stopPx), trigger: 'below', note: 'exit: breakdown or stop' }]);
    return null;
  }

  // Cooldown: wait 24 bars (4 days) after an exit before re-entering this
  // asset, otherwise a choppy market re-triggers the same channel and churns.
  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  // Fresh 20-day high breakout (closed-bar, so identical in backtest/live).
  if (price > hi120) {
    // Size: risk a small fixed share of per-symbol cash on the stop distance,
    // identical to the validated core (1% per asset, 2.5-ATR stop).
    const riskCash = ctx.cash * 0.01;
    const stopDist = 2.5 * atr;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', price: hi120, trigger: 'above', note: '20-day high breakout' }]);
  return null;
}
