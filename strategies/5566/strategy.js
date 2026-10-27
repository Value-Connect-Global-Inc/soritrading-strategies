/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime Timer 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto is priced in dollars, so the direction of the US dollar is a
 * macro force that price alone cannot see. When the trade-weighted dollar is weakening,
 * risk assets like Bitcoin tend to be bid; when the dollar is strengthening, crypto usually
 * bleeds. This strategy rides that currency regime instead of reading candles.
 * When it buys and sells: Every day it compares the latest dollar index (base_usd_broad,
 * Fed broad index, published with a 10-day lag) to its own 30-day average. Dollar below its
 * average (weakening) = long Bitcoin. Dollar above its average (strengthening) = hold cash.
 * It only flips when the dollar has actually moved, so it does not churn on small wiggles.
 * When it does NOT work: In a crypto bull that runs while the dollar is also strong (risk-on
 * in both), it sits in cash and misses the rally. The 10-day publication lag means regime
 * switches are always entered a week and a half late.
 */
function onUpdate(ctx) {
  const dxy = ctx.data("base_usd_broad");
  if (dxy == null) return null; // dollar index not available yet

  // Roll a restart-surviving series of DXY values so we can compare the latest known value
  // to its own 30-day average. The base indicator already carries its 10-day publication
  // lag, so there is no look-ahead.
  let st = ctx.state || {};
  let arr = Array.isArray(st.dxyArr) ? st.dxyArr.slice() : [];
  arr.push(dxy);
  if (arr.length > 32) arr = arr.slice(-32);
  st.dxyArr = arr;
  ctx.state = st;

  if (arr.length < 31) return null; // need 30 days of history

  const latest = arr.at(-1); // latest known DXY (lagged by 10 days already)
  const hist = arr.slice(0, -1).slice(-30);
  const sma = hist.reduce((a, b) => a + b, 0) / hist.length;
  if (sma <= 0) return null;

  const pos = ctx.position;
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  // 0.5% deadband: the dollar must actually be above or below its average before we flip,
  // so normal daily noise does not create churn.
  const strengthen = latest > sma * 1.005;
  const weaken = latest < sma * 0.995;

  if (strengthen && pos > 0) {
    ctx.watch([{ side: 'sell', note: 'dollar strengthening - to cash' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  if (weaken && pos <= 0) {
    ctx.watch([{ side: 'buy', note: 'dollar weakening - long' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
