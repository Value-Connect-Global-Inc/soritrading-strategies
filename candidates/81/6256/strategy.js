/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment is mean-reverting and extreme — when the Fear & Greed
 * Index is in "extreme fear" the crowd is capitulating and prices are usually near a local
 * bottom; buying there and selling once sentiment recovers to neutral has historically
 * captured the rebound. This is a contrarian (buy-the-dip) family, the opposite of
 * trend-following.
 * When it buys and sells: buy BTC when the Fear & Greed Index is below 20 (extreme fear).
 * Sell when it recovers above 55 (neutral), or after 90 days, or a 4x ATR stop is hit.
 * When it does NOT work: in a prolonged bear market the index can stay in extreme fear while
 * price keeps falling (catching a falling knife); buying at extreme fear during a structural
 * crash loses. It also stays out of the market during steady bull climbs where fear never
 * drops to 20, so it misses most of a one-way rally.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const st = ctx.state;

  const fg = ctx.data('main.fear_greed');
  const atr = ctx.atr(14, 1);
  if (atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);

  // ---- exits ----
  if (pos > 0) {
    const stop = ctx.entryPx != null ? ctx.entryPx - 4 * atr : null;
    const recovered = fg != null && fg > 55;
    const heldTooLong = st.entryBar != null && ctx.i - st.entryBar > 90;
    if (recovered || heldTooLong || (stop != null && close < stop)) {
      st.entryBar = null;
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'recover/stop/time exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '4x ATR stop' }]);
    return null;
  }

  // ---- entry: extreme fear ----
  if (fg != null && fg < 20) {
    st.entryBar = ctx.i;
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy',
      price: close,
      trigger: 'above',
      note: 'extreme fear entry',
      conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 20, closed: true }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
