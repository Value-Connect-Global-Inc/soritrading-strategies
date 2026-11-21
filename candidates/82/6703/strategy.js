/*
 * @coinsori-strategy v1
 * name: BTC Regime Filter Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends persist for weeks on the 4h chart, so a long-term moving-average
 * filter separates sustained up-trends from downtrends. We stay long in up-trends and step aside
 * in down-trends, which should cut most of the drawdown while keeping most of the upside.
 * When it buys and sells: we buy when the medium trend (SMA50) turns up above the long trend
 * (SMA200), and re-enter quickly if stopped out while the uptrend is still intact. We exit when
 * the medium trend turns back down or a hard 8% stop is hit. We are flat while the trend is down.
 * When it does NOT work: in a sideways, choppy market the filter whipsaws and fees eat returns;
 * it also misses the first part of a sharp rally because the filter lags.
 */
function onUpdate(ctx) {
  const fast = ctx.sma(50, 1);
  const slow = ctx.sma(200, 1);
  const fastPrev = ctx.sma(50, 2);
  const slowPrev = ctx.sma(200, 2);
  if (fast == null || slow == null || fastPrev == null || slowPrev == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const pos = ctx.position;
  const bullish = fast > slow;
  const wasBullish = fastPrev > slowPrev;
  const entryPx = ctx.entryPx;
  // hard stop: 8% below entry to cap single-trade loss
  const stopPx = entryPx != null ? entryPx * 0.92 : null;

  if (pos > 0) {
    const watch = [];
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: '8% stop' });
    watch.push({ side: 'sell', price: slow, trigger: 'below', note: 'trend down' });
    ctx.watch(watch);
    const flipDown = wasBullish && !bullish;
    const stopHit = stopPx != null && price <= stopPx;
    if (flipDown || stopHit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat
  if (bullish) {
    if (!wasBullish) {
      // fresh golden cross: trend just turned up
      ctx.watch([{ side: 'buy', price: slow, trigger: 'above', note: 'golden cross' }]);
      const qty = ctx.cash / price * 0.99;
      return { side: 'buy', qty };
    }
    // stopped out while trend still up: re-enter when price is back above the medium MA
    ctx.watch([{ side: 'buy', price: fast, trigger: 'above', note: 're-enter uptrend' }]);
    if (price > fast) {
      const qty = ctx.cash / price * 0.99;
      return { side: 'buy', qty };
    }
    return null;
  }

  // regime down: wait for a golden cross
  ctx.watch([{ side: 'buy', price: slow, trigger: 'above', note: 'golden cross' }]);
  return null;
}
