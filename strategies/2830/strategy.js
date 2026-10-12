/*
 * @coinsori-strategy v1
 * name: Donchian Channel Breakout BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian channel breakout is a pure price-based trend
 * family — it enters when price breaks to a fresh 55-day high (a new upward
 * leg) and exits when price closes below its 30-day low (the trend stalls).
 * This is genuinely different from the OBV volume-flow champion (volume-based)
 * and the on-chain fundamental family. The wide 55/30 channel avoids the
 * whipsaw of tighter channels and has been validated to beat buy-and-hold in
 * bull windows on BTC/ETH 1d.
 * When it buys and sells: buys when price closes above the highest high of the
 * prior 55 days; sells when price closes below the lowest low of the prior 30
 * days. Full position, no trend gate (the channel IS the trend filter).
 * When it does NOT work: it is fully invested through the whole trend, so it
 * gives back a large part of gains in sharp reversals (high drawdown), and in
 * range-bound chop the 55-day breakout fires late and exits late, whipsawing.
 */
// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const closes = ctx.closes;
  if (!closes || closes.length < 56) {
    ctx.watch([]);
    return null;
  }

  const i = ctx.i;
  // High of the prior 55 days (excluding current bar) for entry.
  let hi = -Infinity;
  for (let k = 1; k <= 55; k++) {
    const h = ctx.high(1, k);
    if (h != null && h > hi) hi = h;
  }
  // Low of the prior 30 days (excluding current bar) for exit.
  let lo = Infinity;
  for (let k = 1; k <= 30; k++) {
    const l = ctx.low(1, k);
    if (l != null && l < lo) lo = l;
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
    ctx.watch([]);
    return null;
  }

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: lo, trigger: 'below', note: 'Donchian 30D low exit' }]);
    if (price < lo) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: 'Donchian 55D high entry' }]);
  if (price > hi) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
