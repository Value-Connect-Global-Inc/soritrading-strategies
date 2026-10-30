/*
 * @coinsori-strategy v1
 * name: ETH VIX Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a risk asset and tends to fall when US equity volatility (VIX) spikes. VIX is a regime filter that price alone cannot see — it tells us whether the market is in risk-on (calm VIX) or risk-off (panic VIX) mode.
 * When it buys and sells: Buy when VIX is calm (< 25) and ETH is above its 200-bar average (bull regime). Sell when VIX spikes above 30 (risk-off), when ETH falls below its 50-bar average (trend broke), or on a 25% trailing/hard stop.
 * When it does NOT work: VIX is a US-stock fear gauge with a 2-day lag — it is not a perfect crypto risk meter. In a slow grind-down where VIX stays moderate (< 30) but ETH keeps falling, the trend exit saves us but the trailing stop takes the loss. It also misses early bull markets where VIX is still elevated.
 */
function onUpdate(ctx) {
  const vix = ctx.data('base_vix');
  const price = ctx.price;
  const pos = ctx.position;
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (vix == null || sma200 == null || sma50 == null) return null;

  const st = ctx.state || {};
  const entryPx = ctx.entryPx;

  // --- exits while holding ---
  if (pos > 0) {
    const peak = (st.peak == null || price > st.peak) ? price : st.peak;
    st.peak = peak;
    ctx.state = st;

    // hard stop 25% below entry
    if (entryPx != null && price < entryPx * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // trailing stop 25% below peak
    if (price < peak * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // risk-off: VIX spikes above 30 -> get out
    if (vix > 30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // trend broke: price below 50-bar average -> get out
    if (price < sma50) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // --- entry: calm VIX + bull trend ---
  if (vix < 25 && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  return null;
}
