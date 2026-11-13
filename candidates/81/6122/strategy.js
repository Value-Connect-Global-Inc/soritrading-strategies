/*
 * @coinsori-strategy v1
 * name: BTC 1D On-Chain Usage Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies backed by growing network usage (rising number of unique
 * active addresses) tend to be real and sustainable, while rallies without usage growth are
 * speculative and fade. We combine that on-chain signal with the 200-day price trend so we
 * participate in genuine uptrends and step aside when usage or price weakens.
 * When it buys and sells: buys when on-chain usage is accelerating (the 30-day average of
 * active addresses is more than half a standard deviation above its own one-year average)
 * while the close is above the 200-day average; sells when usage contracts below the same
 * threshold or price closes below the 200-day average, or as a safety stop if price falls
 * 25% below entry.
 * When it does NOT work: in a long sideways range usage oscillates around its mean and the
 * strategy whipsaws; if a bull market runs on pure speculation without usage growth it stays
 * out and misses the move; usage data can lag during fast regime changes.
 */

function onUpdate(ctx) {
  const close = ctx.closes.at(-2);       // last closed bar
  const sma200 = ctx.sma(200, 1);        // long-term price trend (closed bar)
  const addr = ctx.data('addr_sma30');   // 30-day avg of unique active addresses (on-chain)
  if (close == null || sma200 == null || addr == null || ctx.price == null) {
    ctx.watch([]);
    return null;
  }

  // keep trailing history of the on-chain series so we measure it against its OWN mean
  const hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 365) hist.shift();   // one-year window
  ctx.state.addrHist = hist;

  // z-score of current usage vs its own trailing mean (shape: change vs own mean, not a level)
  let z = 0;
  if (hist.length >= 60) {               // need a minimum history before trusting the z-score
    const n = hist.length;
    let sum = 0;
    for (let k = 0; k < n; k++) sum += hist[k];
    const mean = sum / n;
    let v = 0;
    for (let k = 0; k < n; k++) v += (hist[k] - mean) * (hist[k] - mean);
    const sd = Math.sqrt(v / n);
    if (sd > 0) z = (addr - mean) / sd;
  }
  const usageUp = z > 0.5;     // usage clearly accelerating vs its own year-average
  const usageDown = z < -0.5;  // usage clearly contracting

  const inPos = ctx.position > 0;
  const entryPx = ctx.entryPx;
  const stopPx = (inPos && entryPx != null) ? entryPx * 0.75 : null; // 25% hard stop vs gap-downs

  const watchList = [
    { side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200', conds: [{ label: 'usage z-score', now: z, op: '>', ref: 0.5, closed: false }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'price below SMA200', conds: [{ label: 'usage z-score', now: z, op: '<', ref: -0.5, closed: false }] }
  ];
  if (stopPx != null) watchList.push({ side: 'sell', price: stopPx, trigger: 'below', note: '25% hard stop' });
  ctx.watch(watchList);

  if (inPos) {
    if (close < sma200 || usageDown) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && ctx.price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null; // no new entries while edge is reduce-only
  if (close > sma200 && usageUp) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
