/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0=extreme fear, 100=extreme greed)
 * is a sentiment gauge. Crowds are most bearish at bottoms (extreme fear) and most
 * bullish at tops (extreme greed). Buying panic and selling euphoria is the classic
 * contrarian bet — a DIFFERENT family from price mean-reversion and trend-following.
 * When it buys and sells: Buy when the index drops below 20 (extreme fear / panic).
 * Sell when it rises above 80 (extreme greed / euphoria) or after 90 days, whichever
 * comes first, to avoid holding forever through a slow grind.
 * When it does NOT work: Sentiment can stay irrational for a long time — extreme fear
 * can persist in a long bear, so buying early costs drawdown. It also gives no signal
 * in the neutral 20-80 range, so it sits in cash for long stretches and misses gradual
 * melt-ups that never reach extreme fear.
 * 2026-05-14: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  if (pos > 0) {
    // Track hold days via state; exit on extreme greed or after 90 days.
    ctx.state.days = (ctx.state.days || 0) + 1;
    // Declare what we are waiting for: exit conditions.
    ctx.watch([
      { side: 'sell', note: 'extreme greed', conds: [{ label: 'Fear & Greed', now: fg, op: '>', ref: 80 }] },
      { side: 'sell', note: '90-day timeout', conds: [{ label: 'Hold days', now: ctx.state.days, op: '>=', ref: 90 }] }
    ]);
    if (fg > 80 || ctx.state.days >= 90) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Extreme fear = panic = contrarian buy zone.
  // Declare what we are waiting for: entry condition.
  ctx.watch([
    { side: 'buy', note: 'extreme fear', conds: [{ label: 'Fear & Greed', now: fg, op: '<', ref: 20 }] }
  ]);
  if (fg < 20) {
    const qty = (ctx.cash / price) * 0.9;
    return { side: 'buy', qty: qty };
  }
  return null;
}
