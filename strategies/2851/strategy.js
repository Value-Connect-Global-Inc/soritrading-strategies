/*
 * @coinsori-strategy v1
 * name: Fed Regime + OnChain Demand Overlay BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin struggles during Fed tightening cycles (rising
 * rates drain liquidity) and thrives when the Fed is on hold or easing. This
 * stays long while the Fed is not hiking. To fix the pure-fed regime's high
 * drawdown (it rides non-hiking bears fully), it adds a defensive on-chain
 * overlay: if active network addresses are collapsing even while the Fed is
 * not hiking, the rally lacks fundamental support, so it exits to cut losses.
 * When it buys and sells: buys while the fed funds rate is not above its
 * level 30 days ago AND network demand is not collapsing; sells when a hike
 * begins OR network demand collapses during a non-hiking period.
 * When it does NOT work: crypto can melt up even while the Fed hikes
 * (liquidity-driven bulls), so it can sit out strong rallies. The on-chain
 * overlay can also exit too early in a genuine bull if a short address
 * dip occurs. It is a slow macro-frequency signal with genuine drawdowns.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // No price/time condition in this strategy — the signal is purely macro/on-chain.
  ctx.watch([]);

  // Fed funds rate now, and its level 30 days ago (external datasets).
  const now = Number(ctx.data('fed'));
  const lag = Number(ctx.data('fed_lag30'));
  if (!Number.isFinite(now) || now <= 0) return null;
  if (!Number.isFinite(lag) || lag <= 0) return null;

  // Hiking if the current rate is above the 30-day-ago level by a small
  // buffer (0.25pp = one typical hike) to avoid churn on tiny moves.
  const hiking = now > lag + 0.25;

  // On-chain demand: active addresses now vs its 30-bar average. If the
  // average is falling, the network is losing users -> weak fundamental support.
  const addrAvg = Number(ctx.data('addr_sma30'));
  if (!Number.isFinite(addrAvg) || addrAvg <= 0) return null;
  // demand weak if the smoothed address count is below its own prior level.
  // Use a hysteresis band to avoid flapping on tiny moves.
  const addrPrev = Number(ctx.data('addr_sma30'));
  // Compare current raw addr to smoothed average: below 97% of average = weak.
  const addrNow = Number(ctx.data('addr'));
  if (!Number.isFinite(addrNow) || addrNow <= 0) return null;
  const demandWeak = addrNow < addrAvg * 0.97;

  // --- Exit: hiking began, OR non-hiking but on-chain demand collapsed ---
  if (pos > 0) {
    if (hiking || demandWeak) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: not hiking AND demand not collapsing ---
  if (!hiking && !demandWeak) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
