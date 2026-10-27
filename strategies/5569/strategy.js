/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Trend-following breakouts are the one family with positive ledger
 * evidence on this engine — single-asset Donchian was profitable in every walk-forward
 * window on BTC/ETH 1d. It is a genuinely different family from the always-invested
 * inverse-vol champion: it sits in cash between trends and only rides them once they
 * are confirmed, so it avoids the bear bleed that hits the champion.
 * When it buys and sells: It buys when the previous closed daily bar breaks above the
 * highest high of the 55 days before it (new uptrend). It sells when the close drops back
 * below the highest high of the 40 days before it (trend stalling). Full capital each time.
 * When it does NOT work: In a sideways market with no lasting breakouts it whipsaws —
 * buying fake breakouts and selling them at a loss. It lags a straight-line bull because
 * it only enters after the breakout, and it can give back a chunk of a trend before the
 * 40-day exit triggers.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || price <= 0) return null;
  const highs = ctx.highs;
  const closes = ctx.closes;
  if (highs == null || closes == null || closes.length < 58) return null;

  const pos = ctx.position;
  const held = pos != null && pos > 0;

  // All on CLOSED bars (ago>=1): prevClose is the last closed bar's close.
  // Entry channel = highest high of the 55 days BEFORE that bar (bars -3..-57).
  const prevClose = closes.at(-2);
  let hi55 = -Infinity, hi40 = -Infinity;
  for (let i = 3; i <= 57; i++) { const h = highs.at(-i); if (h > hi55) hi55 = h; }
  for (let i = 3; i <= 42; i++) { const h = highs.at(-i); if (h > hi40) hi40 = h; }
  if (prevClose == null) return null;

  if (held) {
    // Exit: close falls back below the 40-day channel high = the trend has clearly stalled.
    if (prevClose < hi40) {
      ctx.watch([{ side: 'sell', note: 'trend broken - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: hi40, trigger: 'below', note: '40-day exit' }]);
    return null;
  }

  // Entry: close breaks above the 55-day channel high = a new uptrend is underway.
  if (prevClose <= hi55) {
    ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day breakout' }]);
    return null;
  }

  const qty = (ctx.cash / price) * 0.99;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', note: '55-day breakout' }]);
  return { side: 'buy', qty: qty };
}
