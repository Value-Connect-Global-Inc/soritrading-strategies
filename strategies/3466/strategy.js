/*
 * @coinsori-strategy v1
 * name: DXY Gated BTC Trend 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on 4h during risk-on (weak dollar) regimes; the 200-bar average defines the long-term trend and the EMA crossover catches shorter swings within it.
 * When it buys and sells: Buys only when price is above its 200-bar average AND a 20-bar EMA crosses above a 60-bar EMA, and the Dollar Index is below 104 (weak dollar). Sells when the 20-bar EMA crosses below the 60-bar EMA, or if price falls 8% from the entry.
 * When it does NOT work: In sideways chop below the 200-bar average it never trades (misses bear-market bottoms), and above it the crossover whipsaws during low-volatility consolidation. During a strong-dollar rally (DXY > 104) it stays out and misses the move.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(20, 1), emaS = ctx.ema(60, 1);
  const emaFp = ctx.ema(20, 2), emaSp = ctx.ema(60, 2);
  const sma200 = ctx.sma(200, 1);
  const price = ctx.closes.at(-2);
  if (emaF == null || emaS == null || emaFp == null || emaSp == null || sma200 == null || price == null) return null;

  // ---- exits first: never trap an open position ----
  if (ctx.position > 0 && ctx.entryPx != null) {
    // hard stop: exit if price fell 8% from entry — protects against sharp reversals
    if ((price / ctx.entryPx - 1) * 100 <= -8) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: ctx.entryPx * 0.92, trigger: 'below', note: '-8% hard stop' }]);
  }
  if (ctx.position > 0 && emaFp >= emaSp && emaF < emaS) return { side: 'sell', qty: ctx.position }; // trend broke down
  if (ctx.position > 0) return null;

  // ---- entry only when flat ----
  // Macro filter: only take longs when the Dollar Index is weak (risk-on for crypto).
  // 104 is roughly the long-term middle of DXY; if the series is unavailable (null) we don't block.
  const dxy = ctx.macro('dxy');
  if (dxy != null && dxy >= 104) return null;

  // Entry: fast EMA crosses above slow EMA while price is above the 200-bar trend line.
  if (emaFp <= emaSp && emaF > emaS && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
