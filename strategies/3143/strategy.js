/*
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 * @coinsori-strategy v1
 * name: ADA 1D Donchian Breakout Trend
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Assets that break out of a long consolidation range often
 * keep trending for weeks. A Donchian channel breakout (buy the highest high of
 * the last 55 days) catches these moves on ADA, the one asset where this recipe
 * held up in earlier testing (it failed on BTC/XRP/ETH). Trend-following is a
 * completely different family from the mean-reversion champions.
 * When it buys and sells: buys when the daily close breaks above the highest
 * high of the previous 55 days; sells when the close breaks below the lowest
 * low of the previous 30 days. Always fully in or fully out.
 * When it does NOT work: in long sideways/choppy markets the breakout whipsaws —
 * repeated false breakouts bleed small losses. It gives back part of the trend
 * on every pullback (the 30-day exit is slow). Do not expect it to beat a
 * strong buy-and-hold in a straight melt-up; it wins by avoiding the crashes.
 * Drawdowns are high (50-75%) because it rides volatile ADA down to its exit.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Donchian channels on CLOSED bars only (ago=1) so backtest==live.
  const hi55 = ctx.high(55, 1); // highest high of the last 55 closed bars
  const lo30 = ctx.low(30, 1);  // lowest low of the last 30 closed bars
  if (hi55 == null || lo30 == null) return null;

  const pos = ctx.position;
  ctx.watch(pos > 0
    ? [{ side: 'sell', price: lo30, trigger: 'below', note: '30d low exit' }]
    : [{ side: 'buy', price: hi55, trigger: 'above', note: '55d high breakout' }]);

  if (pos > 0) {
    if (price < lo30) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (price > hi55) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
