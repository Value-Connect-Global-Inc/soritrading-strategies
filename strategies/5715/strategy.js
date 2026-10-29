/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd sentiment. Extreme
 * fear in crypto usually marks local bottoms (the crowd sells out), extreme
 * greed marks tops (the crowd buys the top). This strategy is contrarian:
 * it buys when the crowd is fearful but only while the long-term 200-day
 * trend is still up (so we never catch a falling knife in a real bear), and
 * sells when the crowd turns greedy or the trend breaks. This is a different
 * axis than pure trend-following — it uses crowd sentiment, not just price.
 * When it buys and sells: Buys when Fear&Greed < 25 (fear) AND the previous
 * close is above the 200-day average. Sells when Fear&Greed > 80 (greed) or
 * the close falls below the 200-day average. No other exits.
 * When it does NOT work: In a prolonged bear market the trend filter keeps us
 * out (good) but we also miss every relief rally. If the index is unavailable
 * (before 2018-02) the strategy simply never trades. It can stay in cash for
 * long stretches waiting for fear, and it misses strong bull runs that never
 * dip into fear territory.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Fear & Greed index (0=extreme fear, 100=extreme greed). null = unknown -> do nothing.
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'F&G fear + close above SMA200',
      conds: [
        { label: 'Fear&Greed', now: fg, op: '<', ref: 25, closed: true },
        { label: 'close > SMA200', ok: prevClose > sma200 }
      ] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200',
      conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 80, closed: true }] }
  ]);

  if (pos > 0) {
    // sell on greed OR trend break
    if (fg > 80 || prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  // buy on fear while the long-term uptrend is intact
  if (fg < 25 && prevClose > sma200) {
    const qty = 0.99 * ctx.cash / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
