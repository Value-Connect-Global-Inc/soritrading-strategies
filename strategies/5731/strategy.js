/*
 * @coinsori-strategy v1
 * name: DIAG closes length probe 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic only: logs ctx.closes.length and the SMA20 value so we can see the
 * real array length in this environment.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const sma20 = ctx.sma(20, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma20 == null || atr20 == null) return null;

  if (ctx.i < 8) {
    ctx.log('i=' + ctx.i + ' closesLen=' + (closes ? closes.length : 'null') +
      ' at(-2)=' + (closes && closes.at ? closes.at(-2) : 'no-at') +
      ' sma20=' + sma20);
  }

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    if (prevClose < sma20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;
  if (prevClose > sma20) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
