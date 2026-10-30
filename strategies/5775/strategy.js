/*
 * @coinsori-strategy v1
 * name: BTC DXY Liquidity Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The US dollar index (DXY) is inversely correlated with crypto — a weak dollar
 * means abundant global liquidity, which historically supports risk assets like BTC. This macro
 * signal is a different information source than price, sentiment or on-chain usage: it measures
 * the liquidity regime that drives BTC's long-term direction.
 * When it buys and sells: Buy when the dollar is below its 90-day average (weak-dollar regime),
 * the 200-bar average is rising, and price is above it. Sell when price falls back below the
 * 200-bar average (trend broken), when the dollar rises back above its average (liquidity
 * tightening), or on a 12% hard stop.
 * When it does NOT work: A strong dollar can coexist with a crypto bull during loose monetary
 * policy, so the dollar filter is not a perfect regime gate. It lags buy-and-hold in a weak-dollar
 * bull, and a sudden dollar spike can stop it out before the trend turns.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const dxy = ctx.data('dxy'); // Fed broad dollar index, daily
  if (dxy == null) return null;

  // Keep daily dollar history: push only when the daily value changes.
  const hist = ctx.state.hist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== dxy) {
    hist.push(dxy);
    if (hist.length > 120) hist.shift();
  }
  ctx.state.hist = hist;
  if (hist.length < 90) return null; // need ~90 days of dollar history
  const dxyAvg = hist.reduce((a, b) => a + b, 0) / hist.length; // 90-day dollar average
  const weakDollar = dxy < dxyAvg; // dollar below its own average = liquidity regime

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop on every position
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken SMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    if (price < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (weakDollar === false) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'weak dollar + trend up', conds: [
    { label: 'DXY below 90d avg', ok: weakDollar },
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (weakDollar && trendUp && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
