/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Volatility regime filter. A low VIX means calm risk-on markets where
 * crypto tends to rise; a spiking VIX marks risk-off stress that hits BTC. Trading only the
 * calm regime with a trend gate avoids the panic sell-offs.
 * When it buys and sells: Buys BTC when VIX is below its 50-day average AND price is above
 * its 200-day average. Sells when price closes below the 200-day average or on a hard
 * 2.5-ATR stop.
 * When it does NOT work: In a regime where VIX stays low but crypto corrects on its own
 * (e.g. a crypto-specific deleveraging), the VIX filter adds no protection.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const vix = ctx.data('base_vix');
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  // Maintain a rolling 50-bar window of VIX to compute its own mean (ctx.sma only works on price).
  let vixHist = ctx.state.vixHist || [];
  if (vix != null) {
    vixHist.push(vix);
    if (vixHist.length > 50) vixHist = vixHist.slice(-50);
    ctx.state.vixHist = vixHist;
  }

  const pos = ctx.pos(ctx.sym);
  const entry = ctx.entryPx;
  if (pos > 0) {
    const stop = entry != null && entry > 0 ? entry - 2.5 * atr : null;
    const watchList = [{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 exit' }];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard 2.5 ATR stop' });
    ctx.watch(watchList);
    if (price < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (vixHist.length < 50) return null;
  const vixMean = vixHist.reduce((a, b) => a + b, 0) / vixHist.length;
  if (vix < vixMean && price > sma200) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
