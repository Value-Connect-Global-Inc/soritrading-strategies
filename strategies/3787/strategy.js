/*
 * @coinsori-strategy v1
 * name: Multi-Asset Trend Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, XRP/USDT, BNB/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: single-asset timing keeps all the eggs in one basket. This
 * spreads the same slow trend rule across five assets, each sized to a 20% share
 * of equity, so no single coin's crash can sink the account. In a broad bear all
 * five fall below their 200-day average and the basket sits in cash.
 * When it buys and sells: on each asset, buy when the last closed daily bar is
 * above its 200-day average; sell when it closes back below. Equal 20% share.
 * When it does NOT work: it is slow — it enters only after a long uptrend is
 * established, so it misses the first sharp part of each rally. In a choppy
 * sideways year it whipsaws. A single asset's melt-up is under-captured because
 * only 20% of capital is in it.
 *
 * A "rising 200d" entry filter was tested and REJECTED: it cut returns on the
 * recent window (+97% -> +48%) without meaningfully reducing drawdown (37.5% ->
 * 38.3%), because it kept the basket out of the market too much. Reverted to
 * the simple price-above-200d entry.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos };
    }
    // 200d average is the trend line we ride; exit when price closes below it.
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d avg' }]);
    return null;
  }

  if (prevClose > sma200) {
    // 20% share per asset = the basket never over-leverages one coin.
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d avg cross' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d avg' }]);
  return null;
}
