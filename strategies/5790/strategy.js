/*
 * @coinsori-strategy v1
 * name: BTC Dollar Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Macro regime filter. Crypto is inversely tied to the dollar — a weak
 * dollar (dxy below its own 50-day average) historically supports BTC, a strong dollar
 * pressures it. Trading only the weak-dollar regime with a trend gate avoids the broad
 * sell-off periods and captures the rallies.
 * When it buys and sells: Buys BTC when the dollar index is below its 50-day average AND
 * price is above its 200-day average. Sells when price closes below the 200-day average or
 * on a hard 2.5-ATR stop.
 * When it does NOT work: In a risk-off regime where the dollar and crypto fall together,
 * the dollar filter adds no protection. Also the dxy value is delayed by its 10-day lag.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const dxy = ctx.data('dxy');
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  // Maintain a rolling 50-bar window of the dollar index (ctx.sma only works on price).
  // ctx.data returns the current dxy value; store each into ctx.state to compute its own mean.
  let dxyHist = ctx.state.dxyHist || [];
  if (dxy != null) {
    dxyHist.push(dxy);
    if (dxyHist.length > 50) dxyHist = dxyHist.slice(-50);
    ctx.state.dxyHist = dxyHist;
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

  if (dxyHist.length < 50) return null;
  const dxyMean = dxyHist.reduce((a, b) => a + b, 0) / dxyHist.length;
  if (dxy < dxyMean && price > sma200) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
