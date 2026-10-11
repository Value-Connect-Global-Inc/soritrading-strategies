/*
 * @coinsori-strategy v1
 * name: ETH Trend-Follow EMA50/200 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The EMA50/200 crossover trend core with re-entry was validated
 *   on BTC 4h (+20/+41/+40 across windows, +217% one window). This is a pure
 *   generalization test: the exact same core, no new parameters, on ETH 4h. If the
 *   family edge is real it should not depend on the symbol.
 * When it buys and sells: buys on a bullish EMA50/200 crossover above SMA200, and
 *   re-buys while flat if EMA50>EMA200 and price>SMA400 (trend intact). Sells on
 *   death cross or a hard 2.5x ATR stop.
 * When it does NOT work: in choppy sideways ranges the crossover whipsaws; long-only
 *   means a sustained bear market is flat-to-loss. ETH has historically whipsawed
 *   trend-followers more than BTC — this test shows whether the core survives it.
 */
function onUpdate(ctx) {
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma200 = ctx.sma(200, 1);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma200 == null || sma400 == null || atr == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2.5 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    if (fp > sp && f <= s) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }]);
    return null;
  }

  // entry: fresh bullish cross, OR re-entry while trend intact above SMA400
  let enter = false;
  if (fp <= sp && f > s && prevClose > sma200) enter = true;
  else if (f > s && prevClose > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
