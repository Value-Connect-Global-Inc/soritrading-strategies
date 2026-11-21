/*
 * @coinsori-strategy v1
 * name: BTC Funding Fear Long 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding shows where the crowd is positioned. When funding is
 * negative, shorts pay longs — the crowd is short and often wrong. This buys those fear dips,
 * but only while BTC is still in a medium-term uptrend, so it does not catch falling knives
 * in a confirmed bear market.
 * When it buys and sells: Buy BTC with the whole account when the 8h funding rate is below
 * -0.01% (crowd short) AND the last closed 4h bar is above its 50-bar (about 8 day) SMA.
 * Sell everything when the close rises 2.5x the 14-bar ATR above entry (target), or falls
 * 2.5x ATR below entry (stop), or closes below the 200-bar SMA (regime broken).
 * When it does NOT work: In a slow grinding bear market funding can stay negative for weeks
 * while price keeps falling — the SMA filter keeps us out of most of it, but a sharp dip in
 * a weakening market still risks a small loss. In a quiet bull with no fear spikes there are
 * few entries and the strategy mostly sits in cash.
 */
function onUpdate(ctx) {
  const funding = ctx.funding;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr == null) return null;
    const stop = ctx.entryPx - 2.5 * atr;
    const target = ctx.entryPx + 2.5 * atr;
    const sma200 = ctx.sma(200, 1);
    const watches = [
      { side: 'sell', price: target, trigger: 'above', note: '2.5xATR target' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5xATR stop' }
    ];
    if (sma200 != null) watches.push({ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 regime exit' });

    if (prevClose < stop || (sma200 != null && prevClose < sma200)) {
      ctx.watch(watches);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (prevClose > target) {
      ctx.watch(watches);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watches);
    return null;
  }

  if (funding == null) return null;
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  ctx.watch([{
    side: 'buy', price: sma50, trigger: 'above', note: 'funding fear dip',
    conds: [{ label: 'funding 8h', now: funding, op: '<', ref: -0.0001, closed: true }]
  }]);
  if (funding < -0.0001 && prevClose > sma50) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
