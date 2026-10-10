/*
 * @coinsori-strategy v1
 * name: SOL Fear Greed Capitulation 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: SOL's panic dips are proven buyable by the RSI2 champion, and the
 * Fear & Greed Index is a second, independent signal of crowd capitulation. Combining the
 * sentiment trigger with SOL's sharper moves than BTC could make the sentiment family work
 * where it failed on BTC (too slow, always lagged buy-and-hold).
 * When it buys and sells: Buys SOL when the Fear & Greed index is at or below 20 AND price
 * is above the 200-day average. Sells when the index recovers to 50, after 30 days, or on
 * a 15% stop. Waits 10 days after any exit before re-buying.
 * When it does NOT work: In a bear market the index can sit at extreme fear for months and
 * SOL falls harder than BTC. In a long sideways market with no extreme fear it rarely
 * trades and lags buy-and-hold. No sentiment data before Feb 2018.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (fg == null || price == null || sma200 == null) return null;

  const st = ctx.state;
  const pos = ctx.position;

  if (pos <= 0) {
    if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
    // Extreme fear (<=20) + uptrend = capitulation dip. SMA200 keeps us out of bear knives.
    if (fg <= 20 && price > sma200) {
      st.entryBar = ctx.i;
      st.entryPx = price;
      ctx.watch([{ side: 'sell', price: price * 0.85, trigger: 'below', note: '15% stop' }]);
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  const entry = st.entryPx || price;
  const barsHeld = ctx.i - (st.entryBar || ctx.i);
  const stopped = price <= entry * 0.85;
  ctx.watch([{ side: 'sell', price: entry * 0.85, trigger: 'below', note: '15% stop' }]);
  if (fg >= 50 || stopped || barsHeld >= 30) {
    st.cooldownUntil = ctx.i + 10;
    return { side: 'sell', qty: pos };
  }
  return null;
}
