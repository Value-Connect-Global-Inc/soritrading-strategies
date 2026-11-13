/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index measures crowd sentiment (volatility,
 * momentum, social media, surveys). Extreme fear marks moments when the crowd has given up —
 * often near local lows; extreme greed marks euphoria near local highs. In a long-term
 * uptrend, buying fear and selling greed harvests the bounce that follows panic.
 * When it buys and sells: buys when the index is deeply fearful relative to its own recent
 * history (more than ~1.2 standard deviations below its 90-day average) while the close is
 * above the 200-day average; sells when the index returns to greedy (above its 90-day
 * average) or the close falls below the 200-day average, or as a safety stop if price falls
 * 15% below entry.
 * When it does NOT work: in a sustained bear market fear stays extreme for months and the
 * strategy repeatedly buys falling knives (the SMA200 filter keeps it out of the worst, but
 * any entry it does take can lose); in a quiet low-volatility range the index never gets
 * extreme enough to trigger entries and it sits in cash while the market drifts up.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);       // last closed bar
  const sma200 = ctx.sma(200, 1);        // long-term price trend (closed bar)
  const fg = ctx.data('fear_greed');     // Crypto Fear & Greed Index (0-100)
  if (close == null || sma200 == null || fg == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  // trailing history of the index so we measure it against its OWN recent mean
  const hist = ctx.state.fgHist || [];
  hist.push(fg);
  if (hist.length > 90) hist.shift();    // 90-day window
  ctx.state.fgHist = hist;

  // z-score of current sentiment vs its own trailing mean (shape: vs own mean, not a level)
  let z = 0;
  if (hist.length >= 30) {
    const n = hist.length;
    let sum = 0;
    for (let k = 0; k < n; k++) sum += hist[k];
    const mean = sum / n;
    let v = 0;
    for (let k = 0; k < n; k++) v += (hist[k] - mean) * (hist[k] - mean);
    const sd = Math.sqrt(v / n);
    if (sd > 0) z = (fg - mean) / sd;
  }
  const deepFear = z < -1.2;   // crowd has given up vs its recent norm
  const greedyNow = z > 0.5;   // crowd back to normal/greedy -> take profit

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.85 : null; // 15% hard stop vs gap-downs

  const watchList = [
    { side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200', conds: [{ label: 'Fear&Greed z-score', now: z, op: '<', ref: -1.2, closed: false }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'price below SMA200', conds: [{ label: 'Fear&Greed z-score', now: z, op: '>', ref: 0.5, closed: false }] }
  ];
  if (stopPx != null) watchList.push({ side: 'sell', price: stopPx, trigger: 'below', note: '15% hard stop' });
  ctx.watch(watchList);

  if (inPos) {
    if (close < sma200 || greedyNow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (close > sma200 && deepFear) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
