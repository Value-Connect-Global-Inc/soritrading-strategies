/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — logs per-bar DXY regime values so I can
 * see why the real DXY strategy never trades. Not a trading idea.
 * When it buys and sells: never intentionally trades; only logs.
 * When it does NOT work: this is a diagnostic, not a strategy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.dxyHist = s.dxyHist ?? [];
    const d = ctx.data('dxy');
    if (d != null) s.dxyHist.push(d);
    if (s.dxyHist.length > 20) s.dxyHist.shift();
    s.lastBarI = ctx.i;
  }
  const hist = s.dxyHist;
  if (hist == null || hist.length < 20) return null;

  const cur = hist[hist.length - 1];
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  const weakDollar = cur < avg;
  const sma200 = ctx.sma(200, 1);
  ctx.log('bar', ctx.i, 'dxyCur', cur, 'avg', avg, 'weak', weakDollar, 'sma200', sma200, 'price', price);
  return null;
}
