/*
 * @coinsori-strategy v1
 * name: FG Data Diagnostic (buy first fear, hold)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * DIAGNOSTIC ONLY: buys on the first bar where yesterday's Fear & Greed index
 * is below 25, then never sells (end-of-data close). Verifies that
 * ctx.data('fear_greed') aligns to daily bars correctly. Not a real strategy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const fgVal = Number(fg);
  if (!Number.isFinite(fgVal)) return null;

  const fgPrev = ctx.state.fgPrev;
  ctx.state.fgPrev = fgVal;
  if (fgPrev == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) return null;   // hold forever

  if (fgPrev < 25) {
    const qty = (ctx.cash / price) * 0.9;
    if (qty <= 0) return null;
    return { side: 'buy', qty };
  }
  return null;
}
