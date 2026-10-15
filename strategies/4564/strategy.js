/*
 * @coinsori-strategy v1
 * name: ATR Spike Crash Protection BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC rises over the long run but crashes happen fast, and
 * those crashes show up first as an explosion in daily volatility (ATR). This
 * strategy holds BTC normally but hides in cash when volatility spikes above a
 * calm baseline, then re-enters once volatility settles. A pure risk-timing
 * overlay, no leverage.
 * When it buys and sells: sells to cash when ATR(14) exceeds 1.9x its 50-day
 * average (vol explosion), buys back when ATR drops below 1.4x the average
 * (hysteresis avoids whipsaw around the threshold).
 * When it does NOT work: if the crash is a single day's gap it may already be
 * done when the ATR signal fires; in a slow grinding bear the ATR never spikes
 * enough to trigger, so it holds and loses. It also lags a straight-line bull
 * because it re-enters only after vol settles.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  // 50-day average of ATR — the calm baseline. Only closed bars (ago>=1) so
  // backtest == live.
  let atrAvg = 0;
  let n = 0;
  for (let k = 1; k <= 50; k++) {
    const a = ctx.atr(14, k);
    if (a == null) break;
    atrAvg += a;
    n++;
  }
  if (n < 40) return null; // need enough history for a stable baseline
  atrAvg /= n;

  const ratio = atr / atrAvg;
  // Vol explosion = danger. Above 1.9x baseline we hide in cash.
  const spike = ratio > 1.9;
  // Re-enter only after vol settles below 1.4x baseline (hysteresis).
  const calm = ratio < 1.4;

  const pos = ctx.position;
  if (spike && pos > 0) {
    ctx.watch([{ side: 'sell', note: 'hide: vol spike',
                 conds: [{ label: 'ATR ratio', now: ratio, op: '>', ref: 1.9, closed: true }] }]);
    return { side: 'sell', qty: pos };
  }
  if (!spike && calm && pos <= 0) {
    const qty = (ctx.cash * 0.95) / price;
    ctx.watch([{ side: 'buy', note: 're-enter: vol calm',
                 conds: [{ label: 'ATR ratio', now: ratio, op: '<', ref: 1.4, closed: true }] }]);
    return { side: 'buy', qty };
  }
  if (pos > 0) {
    ctx.watch([{ side: 'sell', note: 'hide: vol spike',
                 conds: [{ label: 'ATR ratio', now: ratio, op: '>', ref: 1.9, closed: true }] }]);
  } else {
    ctx.watch([{ side: 'buy', note: 're-enter: vol calm',
                 conds: [{ label: 'ATR ratio', now: ratio, op: '<', ref: 1.4, closed: true }] }]);
  }
  return null;
}
