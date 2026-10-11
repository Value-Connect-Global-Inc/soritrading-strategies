/*
 * @coinsori-strategy v1
 * name: BTC 1D Squeeze-Breakout Only (upbit)
 * ex: upbit
 * syms: BTC
 * interval: 1d
 * cash: 10000000
 *
 * Why this strategy: A pure volatility-expansion breakout. Buy a fresh 20-day
 * high only when Bollinger width has compressed into the quietest 20% of the
 * last 40 bars — the classic squeeze pattern that often precedes a strong move.
 * The rising 60-day average gate keeps it out of bear markets, and a full-size
 * position lets it capture the expansion leg of a bull. This avoids the
 * falling-knife problem of mean-reversion entries in a strong uptrend.
 * When it buys and sells: Buy when price closes above the 20-day high AND
 * Bollinger width is in the quietest 20% of the last 40 bars, while the 60-day
 * average is rising. Sell when price closes back below the 20-day EMA.
 * When it does NOT work: False breakouts resolve down and trigger a loss; in a
 * choppy range the squeeze fires into reversals. It sits in cash during bears
 * (the rising gate blocks entries), so it lags buy-and-hold in a melt-up that
 * never pauses to compress.
 * 2026-05-12 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const sma60 = ctx.sma(60, 1);
  const sma60prev = ctx.sma(60, 2);
  const ema20 = ctx.ema(20, 1);
  const bb = ctx.bb(20, 2, 1);
  const high20 = ctx.high(20, 1);
  if (sma60 == null || sma60prev == null || ema20 == null || bb == null || high20 == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma60 > sma60prev;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'below', qty: pos, note: 'exit close < EMA20' }]);
    if (price < ema20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([{ side: 'buy', price: high20, trigger: 'above', qty: (ctx.cash / price) * 0.95, note: 'squeeze breakout', conds: [{ label: 'SMA60 rising', now: sma60, op: '>', ref: sma60prev, closed: true }] }]);
    return null;
  }

  // Squeeze: current Bollinger width in the quietest 20% of the last 40 bars.
  const widthNow = bb.upper - bb.lower;
  const widths = [];
  for (let k = 1; k <= 40; k++) {
    const b = ctx.bb(20, 2, k);
    if (b == null) continue;
    widths.push(b.upper - b.lower);
  }
  if (widths.length < 30) {
    ctx.watch([]);
    return null;
  }
  const sorted = widths.slice().sort((a, b) => a - b);
  const quietThresh = sorted[Math.floor(sorted.length * 0.2)];
  const squeezed = widthNow <= quietThresh;

  ctx.watch([{ side: 'buy', price: high20, trigger: 'above', qty: (ctx.cash / price) * 0.95, note: 'squeeze breakout', conds: [
    { label: 'SMA60 rising', now: sma60, op: '>', ref: sma60prev, closed: true },
    { label: 'BB width in quietest 20%', now: widthNow, op: '<=', ref: quietThresh, closed: true }
  ] }]);

  if (squeezed && price > high20) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
