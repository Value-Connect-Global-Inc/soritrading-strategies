/*
 * @coinsori-strategy v1
 * name: ETH VIX Donchian Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a risk asset and tends to fall when US equity volatility (VIX) spikes. VIX is a regime filter price alone cannot see — it separates risk-on (calm VIX) from risk-off (panic VIX). A 55-bar Donchian breakout catches genuine up-moves, and the calm-VIX gate keeps us out of panic-driven whipsaws.
 * When it buys and sells: Buy when VIX is calm (< 28) and price breaks above the highest high of the last 55 bars. Sell only on a 25% trailing stop or 25% hard stop (no tight trend exit that whipsaws).
 * When it does NOT work: VIX is a US-stock fear gauge with a 2-day lag, not a perfect crypto risk meter. In a slow grind-down where VIX stays calm but ETH slowly falls, the trailing stop takes the loss. It also misses very early bull markets while VIX is still elevated.
 */
function onUpdate(ctx) {
  const vix = ctx.data('base_vix');
  const price = ctx.price;
  const pos = ctx.position;
  const dc = ctx.donchian(55, 1);
  if (vix == null || dc == null) return null;

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
    // trailing stop 25% below the highest price since entry
    if (price < peak * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // risk-off: VIX spikes above 30 -> get out
    if (vix > 30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // --- entry: calm VIX + 55-bar Donchian breakout ---
  // 28: VIX above ~28 signals real market stress; below it is normal risk-on
  if (vix < 28 && price > dc.upper) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  return null;
}
