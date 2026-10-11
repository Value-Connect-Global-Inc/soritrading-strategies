/*
 * @coinsori-strategy v1
 * name: DXY Gated BTC Trend 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on 4h during risk-on (weak dollar) regimes; the long average defines the long-term trend and a slow EMA crossover catches only clear trends, filtering out chop.
 * When it buys and sells: Buys only when price is above its 400-bar average AND a 50-bar EMA crosses above a 200-bar EMA, and the Dollar Index is below 104 (weak dollar). Sells when the 50-bar EMA crosses below the 200-bar EMA, or if price falls 8% from entry.
 * When it does NOT work: In sideways chop below the 400-bar average it never trades (misses bear-market bottoms), and above it the slow crossover still whipsaws during low-volatility consolidation. During a strong-dollar rally (DXY > 104) it stays out and misses the move.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1), emaS = ctx.ema(200, 1);
  const emaFp = ctx.ema(50, 2), emaSp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const price = ctx.closes.at(-2);
  if (emaF == null || emaS == null || emaFp == null || emaSp == null || sma400 == null || price == null) return null;

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

  // Entry: slow EMA cross above while price holds above the long-term (400-bar) trend line.
  if (emaFp <= emaSp && emaF > emaS && price > sma400) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
