/*
 * @coinsori-strategy v1
 * name: DataDiag
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — verifies that Number(fg) coerces the
 * external fear_greed value into a real 0..100 index. Buy only when the
 * coerced value is a plausible index (< 50), then sell next bar.
 * When it buys and sells: buy 0.0001 BTC when Number(fg)<50, sell next bar.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || fg == null) return null;
  const fgNum = Number(fg);
  if (!Number.isFinite(fgNum)) return null;
  if (ctx.position > 0) return { side: 'sell', qty: ctx.position };
  if (fgNum < 50 && fgNum >= 0) return { side: 'buy', qty: 0.0001 };
  return null;
}
