/*
 * @coinsori-strategy v1
 * name: MultiAsset Trend EMA50/200 4H (baseline check)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: verbatim copy of the validated 4-asset EMA50/200 trend
 * core (strategy 4597) used ONLY as a baseline reference to compare against
 * the hash-rate-gated variant on identical windows. Not a new idea.
 * When it buys and sells: buy on a bullish EMA50/200 cross or while the trend
 * is intact (EMA50>EMA200 and price above the 400-period average); sell on a
 * death cross or when price falls 2.5 ATR below entry; 24-bar re-entry cooldown.
 * When it does NOT work: choppy sideways ranges whipsaw the crossovers; a
 * sustained bear market is flat-to-loss (long-only).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const fp = ctx.ema(50, 2), sp = ctx.ema(200, 2);
  const sma400 = ctx.sma(400, 1);
  const atr = ctx.atr(14, 1);
  if (f == null || s == null || fp == null || sp == null || sma400 == null || atr == null) return null;

  const sym = ctx.sym;
  const st = ctx.state || {};
  if (!st.cool) st.cool = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    if (f <= s) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    if (price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR from entry' }]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;

  let enter = false;
  if (fp <= sp && f > s) enter = true;
  else if (f > s && price > sma400) enter = true;
  if (!enter) return null;

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
