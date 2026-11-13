/*
 * @coinsori-strategy v1
 * name: BTC 4H Wide-Channel Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's uptrends are long but choppy. Entering on a 100-bar-high
 * breakout only when price is above its 200-bar average keeps the position long through
 * a bull market but refuses to buy failed bounces in a bear. Exiting when price breaks
 * the 200-bar low cuts a bear market short, and a 20% disaster stop caps the loss of
 * any single failed breakout.
 * When it buys and sells: buys when price rises above the highest high of the last 100
 * bars while price is above the 200-bar average; sells when price falls below the lowest
 * low of the last 200 bars, or drops 20% below the entry price as a disaster stop.
 * When it does NOT work: a long sideways range with no trend — price keeps crossing the
 * 200-bar low and each re-entry is a small loss plus fees, so it bleeds slowly in chop.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const st = ctx.state;

  // wide channels and trend line from CLOSED bars only (identical in backtest, paper, live)
  let hh100 = -Infinity, ll200 = Infinity;
  for (let i = 1; i <= 100; i++) hh100 = Math.max(hh100, ctx.highs.at(-1 - i));
  for (let i = 1; i <= 200; i++) ll200 = Math.min(ll200, ctx.lows.at(-1 - i));
  const sma200 = ctx.sma(200, 1);
  if (!isFinite(hh100) || !isFinite(ll200) || sma200 == null) return null;
  const price = ctx.price;

  if (pos > 0) {
    // 20% disaster stop caps a single failed breakout; the 200-bar low is the trend exit
    if (st.stop == null) st.stop = (ctx.entryPx != null ? ctx.entryPx : price) * 0.80;
    ctx.watch([
      { side: 'sell', price: ll200, trigger: 'below', note: '200-bar low exit' },
      { side: 'sell', price: st.stop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (price < ll200 || price <= st.stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  st.stop = null;
  // entry also needs the long-term trend up, so we never buy a failed bounce in a bear
  ctx.watch([
    { side: 'buy', price: hh100, trigger: 'above', note: '100-bar high recovery',
      conds: [{ label: 'above 200-bar SMA', ok: price > sma200 }] }
  ]);
  if (price > hh100 && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
