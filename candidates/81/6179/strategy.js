/*
 * @coinsori-strategy v1
 * name: BTC 4H Wide-Channel Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's uptrends are long but choppy. A wide 100-bar-high entry /
 * 200-bar-low exit stays invested through normal pullbacks and only steps out when a
 * major (about a month-long) trend breaks. The base state is long, so it captures most
 * of a bull market like buy-and-hold, but it exits before a bear market deepens.
 * When it buys and sells: buys when price rises above the highest high of the last 100
 * bars; sells when price falls below the lowest low of the last 200 bars, or drops 35%
 * below the entry price as a disaster stop.
 * When it does NOT work: a long sideways range with no trend — price keeps crossing the
 * 200-bar low and each re-entry is a small loss plus fees, so it bleeds slowly in chop.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const st = ctx.state;

  // wide channels from CLOSED bars only (identical in backtest, paper and live)
  let hh100 = -Infinity, ll200 = Infinity;
  for (let i = 1; i <= 100; i++) hh100 = Math.max(hh100, ctx.highs.at(-1 - i));
  for (let i = 1; i <= 200; i++) ll200 = Math.min(ll200, ctx.lows.at(-1 - i));
  if (!isFinite(hh100) || !isFinite(ll200)) return null;
  const price = ctx.price;

  if (pos > 0) {
    // 35% disaster stop as tail protection; the 200-bar low is the normal trend exit
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.65;
    ctx.watch([
      { side: 'sell', price: ll200, trigger: 'below', note: '200-bar low exit' },
      { side: 'sell', price: st.stop, trigger: 'below', note: '35% disaster stop' }
    ]);
    if (price < ll200 || price <= st.stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  ctx.watch([{ side: 'buy', price: hh100, trigger: 'above', note: '100-bar high recovery' }]);
  if (price > hh100) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
