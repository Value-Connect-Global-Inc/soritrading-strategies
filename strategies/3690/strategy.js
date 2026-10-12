/*
 * @coinsori-strategy v1
 * name: DataDiag
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic only — determines the shape of external
 * dataset values inside a backtest by attempting trades on them.
 * When it buys and sells: buys 0.001 BTC whenever fear_greed or dxy is a
 * usable number; the trade count reveals which keys load and their type.
 * When it does NOT work: n/a (diagnostic).
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const dxy = ctx.data('dxy');
  const sma200 = ctx.sma(200, 1);
  // Count how many bars have a usable numeric value for each dataset.
  const st = ctx.state;
  st.n = (st.n || 0) + 1;
  if (fg != null && (typeof fg === 'number' || typeof fg === 'string')) st.fgOk = (st.fgOk || 0) + 1;
  if (dxy != null && (typeof dxy === 'number' || typeof dxy === 'string')) st.dxyOk = (st.dxyOk || 0) + 1;
  if (ctx.i % 500 === 0) {
    ctx.log('i=' + ctx.i + ' fg=' + JSON.stringify(fg) + ' dxy=' + JSON.stringify(dxy) + ' sma200=' + (sma200 == null ? 'null' : sma200.toFixed(0)));
  }
  // Trade a tiny amount if either dataset is present, to confirm loading.
  if (sma200 != null && fg != null) {
    return { side: 'buy', qty: 0.0001 };
  }
  if (sma200 != null && dxy != null && ctx.position <= 0) {
    return { side: 'buy', qty: 0.0001 };
  }
  if (ctx.position > 0) return { side: 'sell', qty: ctx.position };
  return null;
}
