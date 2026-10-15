/*
 * @coinsori-strategy v1
 * name: Dollar-Cost-Averaging Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset — it tends to rally when the US
 * dollar weakens and struggle when it strengthens. We only buy momentum when the
 * dollar is in a weak regime, skipping the phases where a strong dollar squeezes risk.
 * When it buys and sells: buys when 30-day return is positive, close is above the
 * 200-day EMA, and the dollar is below its own 60-day average. Sells when close
 * falls below the 200-day EMA, 30-day return turns negative, or a 15% hard stop.
 * When it does NOT work: the dollar is a slow macro signal — it lags a sudden
 * risk-off crash by weeks and is business-days-only, so weekend entries can slip
 * past the filter. It will not protect against a fast dollar spike.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const dxy = ctx.data('dxy');
  const hist = ctx.state.dxyHist || [];
  if (dxy != null) {
    hist.push(dxy);
    if (hist.length > 60) hist.shift();
    ctx.state.dxyHist = hist;
  }
  if (ctx.i % 50 === 0) {
    ctx.log('i=' + ctx.i + ' dxy=' + dxy + ' histLen=' + hist.length +
            ' mom30=' + mom30.toFixed(3) + ' ema200=' + ema200.toFixed(0));
  }
  return null;
}
