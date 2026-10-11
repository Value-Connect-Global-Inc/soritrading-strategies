/*
 * @coinsori-strategy v1
 * name: Alt 1D ATR-Adaptive Keltner MR
 * ex: binance
 * syms: LINKUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same ATR-adaptive Keltner mean-reversion recipe that was
 * positive on ~29/32 windows across 11 assets and on SOL 1D. This variant tests
 * whether the recipe generalizes to more alts (LINK/ADA/BNB). High-beta alts pull
 * back hard and snap back fast — the regime mean reversion exploits. The ATR-
 * adaptive lower band (EMA20 minus 2.5x ATR) widens the buy zone in volatile
 * regimes, and a rising 200-day average gates entries to healthy uptrends only.
 * When it buys and sells: Buys when price closes below the ATR-adaptive lower
 * Keltner band with RSI below 40 while price is above a rising 200-day average.
 * Sells on the snap-back above the mid band (EMA20) or when RSI climbs above 60.
 * When it does NOT work: In a broad crypto bear the 200-day gate keeps us out of
 * most trades (capital-preserving but misses nothing), and it badly lags buy-and-
 * hold in relentless melt-ups because it sits in cash waiting for a pullback.
 *
 * 2025-01-XX: Display-only change — added ctx.watch declarations; trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null) return null;

  const lowerBand = ema20 - 2.5 * atr;
  const uptrend = sma200 > sma200prev;

  if (pos > 0) {
    // Exit conditions
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 mid band exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] },
      { side: 'sell', price: null, trigger: null, note: 'RSI > 60 exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    if (price > ema20 || rsi > 60) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry conditions
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'ATR-adaptive lower band', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);

  if (uptrend && price < lowerBand && rsi < 40) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
