/*
 * @coinsori-strategy v1
 * name: BTC 1M EMA Momentum Trend-Gated Trail
 * ex: binance
 * syms: BTC/USDT
 * interval: 1m
 * cash: 10000
 *
 * Why this strategy: short-term momentum (price crossing above a 20-bar EMA) is only trusted when
 * the intraday trend (200-bar EMA) is also up, so it stops buying into falling markets where the
 * earlier version whipsawed and lost more than holding.
 * When it buys and sells: buys on a closed-bar EMA20 up-cross while price is above EMA200; exits
 * on a 1.2% trailing stop from the highest price reached, so winners can run instead of being
 * capped by a fixed take-profit that fees ate.
 * When it does NOT work: in a tight sideways range where even the trend filter chops, and it sits
 * flat through a slow grind down (that is the point - it avoids the drawdown).
 */

function onUpdate(ctx) {
  const ema20_1 = ctx.ema(20, 1);
  const ema20_2 = ctx.ema(20, 2);
  const ema20_3 = ctx.ema(20, 3);
  const trend = ctx.ema(200, 1);
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  // Peak price while holding, kept in restart-safe state; seeded from entry on a fresh start.
  let peak = ctx.state.peak != null ? ctx.state.peak : (entry != null ? entry : ctx.price);
  const trailPct = 0.012; // 1.2% trail: a few times the 0.2% round-trip fee so fees don't eat winners
  const trailStop = peak * (1 - trailPct);

  ctx.watch([
    { side: 'buy', price: trend != null ? trend : 0, trigger: 'above', note: 'EMA20 cross above EMA200', conds: [{ label: 'EMA20 upcross', ok: ema20_1 != null && ema20_2 != null && ema20_1 > ema20_2, closed: true }] },
    { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing stop 1.2%' }
  ]);

  if (ema20_1 == null || ema20_2 == null || ema20_3 == null || trend == null) return null;
  const c2 = ctx.closes.at(-2);
  const c3 = ctx.closes.at(-3);
  const crossUp = c3 <= ema20_3 && c2 > ema20_2;

  if (pos <= 0) {
    if (crossUp && c2 > trend) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
    }
    return null;
  }

  // While holding: ratchet the peak up, exit when price trails 1.2% below it.
  if (ctx.price > peak) {
    ctx.state.peak = ctx.price;
  }
  if (ctx.price <= peak * (1 - trailPct)) {
    ctx.state.peak = null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
