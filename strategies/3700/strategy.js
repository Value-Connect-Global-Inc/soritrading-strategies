/*
 * @coinsori-strategy v1
 * name: FearGreedTrendDip
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crowd sentiment is mean-reverting. When the Fear & Greed
 * index hits a fresh panic extreme (lowest in a month) inside an uptrend, the
 * crowd is capitulating and short-term downside is often exhausted — a good
 * place to buy. We hold until the trend itself breaks, letting winners run.
 * When it buys and sells: buy only when the Fear & Greed index is a fresh
 * 30-day low AND is at or below 30 (panic) AND price is above its 200-day
 * average (uptrend). Sell when price closes below its 50-day average or on a
 * 2x ATR stop below entry. No "sell into greed" exit — that caused churn.
 * When it does NOT work: in a long, quiet bull market the index rarely hits a
 * fresh panic extreme, so it trades rarely and misses most of the rally. In a
 * grinding bear where price stays above the 200-day average for a while it
 * can buy a dip that keeps falling. A slow bleed below the 50-day after entry
 * gives back gains before the stop triggers.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const fg = ctx.data('fear_greed');        // 0-100 daily sentiment index
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || sma200 == null || sma50 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Rolling 30-day low of the Fear&Greed index, tracked in state (ctx.data has
  // no history access). Push current value, drop values older than 30 bars.
  const st = ctx.state;
  if (st.fgHist == null) st.fgHist = [];
  if (st.fgBar !== ctx.i) {
    st.fgHist.push(fg);
    if (st.fgHist.length > 30) st.fgHist.shift();
    st.fgBar = ctx.i;
  }
  const fgMin = Math.min(...st.fgHist);

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < sma50) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Fresh panic extreme: fg is the lowest of the last 30 days AND <=30. This
  // makes entries rare (a few per year), unlike every fg<=30 day which churned.
  if (fg <= 30 && fg <= fgMin && prevClose > sma200) {
    const qty = (ctx.cash / price) * 0.30; // 30% per asset, 3 assets = max 90% book
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend filter',
               conds: [{ label: 'Fear&Greed fresh low', now: fg, op: '<=', ref: 30, closed: true }] }]);
  return null;
}
