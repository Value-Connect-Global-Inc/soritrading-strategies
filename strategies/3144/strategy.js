/*
 * @coinsori-strategy v1
 * name: ADA 1D Defensive Donchian
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The plain Donchian 55/30 breakout works on ADA but rides
 * volatile ADA down to its exit, giving 50-75% drawdowns. This defensive
 * variant blocks entries only while the long-term trend is still FALLING
 * (steep-downtrend filter) — it dodges the deep-bear breakouts that cause the
 * worst drawdowns, but still allows the first breakout off a crash bottom once
 * the 200-day average flattens. A plain "price above SMA200" gate was too slow
 * and blocked ADA's 2022-24 recovery entirely.
 * When it buys and sells: buys when the daily close breaks above the 55-day
 * high AND the 200-day average is not falling (SMA200 now >= SMA200 20 bars
 * ago). Sells when the close breaks below the 30-day low.
 * When it does NOT work: sideways chop still whipsaws the breakout, and in a
 * straight melt-up it lags buy-and-hold. The trend gate can still miss the
 * very start of a recovery that begins while the 200-day average is falling.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hi55 = ctx.high(55, 1);
  const lo30 = ctx.low(30, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200_20ago = ctx.sma(200, 21); // 200-SMA as of 20 bars back
  if (hi55 == null || lo30 == null || sma200 == null || sma200_20ago == null) return null;

  // Same trend-gate value used by the decision below, only declared for watch now.
  const trendFalling = sma200 < sma200_20ago;

  const pos = ctx.position;
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: lo30, trigger: 'below', note: '30d low exit' }
    ]);
    if (price < lo30) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      price: hi55,
      trigger: 'above',
      note: '55d high breakout',
      conds: [
        { label: 'SMA200 not falling', ok: !trendFalling }
      ]
    }
  ]);

  // Block entries only while the long-term trend is still falling (steep-downtrend filter)
  if (price > hi55 && !trendFalling) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
