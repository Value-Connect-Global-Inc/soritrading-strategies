/*
 * @coinsori-strategy v1
 * name: BTC Fear & Greed Dip-Buy 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a long-term uptrend, panic (extreme fear in the Fear & Greed index) marks short-term dips that historically recover — a "buy the dip" edge. The long-term-trend gate keeps it out of bear markets where panic means a falling knife.
 * When it buys and sells: It buys when price is above its 200-day average AND the Fear & Greed index is at or below 25 (fear). It sells when the index recovers to 55 or price falls 20% below entry as a disaster stop.
 * When it does NOT work: It lags buy-and-hold in strong one-way bull runs because it only enters on fear dips and exits early on recovery. In a choppy uptrend with repeated fear spikes it can churn through several small stop-losses.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  const sma200 = ctx.sma(200, 1);
  if (fg == null || sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // 20% disaster stop below entry — caps damage if a dip keeps falling
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null;
    ctx.watch([
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'F&G recovered', conds: [{ label: 'F&G', now: fg, op: '>=', ref: 55, closed: true }] }
    ]);
    if (fg >= 55) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Only buy panic dips while the long-term trend is up — otherwise fear = falling knife
  if (fg <= 25 && prevClose > sma200) {
    // 60% of cash per dip buy; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
