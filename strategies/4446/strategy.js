/*
 * @coinsori-strategy v1
 * name: DXY Gate BTC Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies when the US dollar weakens (risk-on flows); this strategy only goes long when the dollar is falling, so it skips dollar-strength bear regimes.
 * When it buys and sells: Buys when BTC is above its 50-day average AND the dollar index has fallen over the last 5 days; sells when either condition flips, or a 15% stop loss is hit.
 * When it does NOT work: In choppy sideways markets where BTC and the dollar move together, or if the dollar falls while BTC also falls (liquidity squeeze), the filter adds no edge and whipsaws.
 */
function onUpdate(ctx) {
  // DIAGNOSTIC PROBE: which data accessor works?
  const m = ctx.macro('dxy');
  const d = ctx.data('dxy');
  if (ctx.i % 50 === 0) {
    ctx.log('i=' + ctx.i + ' macro=' + m + ' data=' + d);
  }
  if (d == null) return null; // probe only, no trading logic yet

  const px = ctx.price;
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  const hist = ctx.state.dxyHist || [];
  hist.push(d);
  if (hist.length > 6) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 6) return null;

  const dxy5 = (hist[hist.length - 1] - hist[0]) / hist[0];
  const trendUp = px > sma50;
  const dollarFalling = dxy5 < 0;

  if (ctx.position <= 0) {
    if (trendUp && dollarFalling) {
      return { side:'buy', qty: ctx.cash / px * 0.99 };
    }
    return null;
  }

  const entryPx = ctx.entryPx;
  const stopPx = entryPx != null ? entryPx * 0.85 : null;
  const stopHit = stopPx != null && px <= stopPx;
  const exit = (!trendUp || !dollarFalling) || stopHit;
  if (exit) return { side:'sell', qty: ctx.position };
  return null;
}
