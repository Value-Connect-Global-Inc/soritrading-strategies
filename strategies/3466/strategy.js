/*
 * @coinsori-strategy v1
 * name: DXY Gated BTC Trend 4H ATR
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on 4h during risk-on (weak dollar) regimes; the 400-bar average defines the long-term trend, a slow EMA crossover enters, and a volatility-adaptive ATR trailing stop lets winners run while capping losses.
 * When it buys and sells: Buys when price is above its 400-bar average AND a 50-bar EMA crosses above a 200-bar EMA, and the Dollar Index is below 104 (weak dollar). Sells when price falls 3x ATR(14) below the highest close since entry — a wider stop in wild markets, a tighter one in calm ones.
 * When it does NOT work: In sideways chop below the 400-bar average it never trades (misses bear-market bottoms), and in a strong-dollar rally (DXY > 104) it stays out and misses the move. The ATR stop can still be hit during long low-volatility consolidation.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1), emaS = ctx.ema(200, 1);
  const emaFp = ctx.ema(50, 2), emaSp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  const price = ctx.closes.at(-2);
  if (emaF == null || emaS == null || emaFp == null || emaSp == null || sma400 == null || atr == null || price == null) return null;

  // ---- trailing stop exit (volatility-adaptive: 3x ATR(14) below the peak) ----
  // Reason for 3x ATR: fixed % stops get whipsawed in low-vol consolidation and
  // cut winners short in high-vol trends; ATR scales the stop to current vol.
  if (ctx.position > 0) {
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state.hi = hi;
    const stopPx = hi - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR trailing stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  // Macro filter: only take longs when the Dollar Index is weak (risk-on for crypto).
  // 104 is roughly the long-term middle of DXY; if the series is unavailable (null) we don't block.
  const dxy = ctx.macro('dxy');
  if (dxy != null && dxy >= 104) return null;

  // Entry: slow EMA cross above while price holds above the long-term (400-bar) trend line.
  if (emaFp <= emaSp && emaF > emaS && price > sma400) {
    ctx.state.hi = price; // trail starts at entry
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
