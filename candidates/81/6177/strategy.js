/*
 * @coinsori-strategy v1
 * name: BTC 4H Donchian Turtle Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: trends on BTC persist once they start. A breakout above the highest
 * high of the last 55 bars is the signal that a new up-leg is underway, and holding it
 * until price breaks below the last 20-bar low lets a winner run while cutting losses
 * short. This is trend-following, the opposite family from the mean-reversion attempts.
 * When it buys and sells: buys when price closes above the 55-bar high; sells when price
 * breaks below the 20-bar low, or drops 15% below the entry price as a disaster stop.
 * When it does NOT work: a long sideways range with no trend — every breakout fails and
 * every exit is a small loss plus fees, so it bleeds slowly in chop.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const st = ctx.state;

  // channel levels from CLOSED bars only (identical in backtest, paper and live)
  const n = 55, m = 20;
  let hh = -Infinity, ll = Infinity;
  for (let i = 1; i <= n; i++) hh = Math.max(hh, ctx.highs.at(-1 - i));
  for (let i = 1; i <= m; i++) ll = Math.min(ll, ctx.lows.at(-1 - i));
  if (!isFinite(hh) || !isFinite(ll)) return null;
  const price = ctx.price;

  if (pos > 0) {
    // 15% disaster stop as tail protection; the 20-bar low is the normal exit
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.85;
    ctx.watch([
      { side: 'sell', price: ll, trigger: 'below', note: '20-bar low exit' },
      { side: 'sell', price: st.stop, trigger: 'below', note: '15% disaster stop' }
    ]);
    if (price < ll || price <= st.stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: '55-bar high breakout' }]);
  if (price > hh) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
