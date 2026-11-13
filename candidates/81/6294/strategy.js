/*
 * @coinsori-strategy v1
 * name: BTC Funding Sentiment Reversal 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding rates reveal how crowded a trade is. Deeply negative funding
 * means shorts are overcrowded and a short-squeeze (price bounce) is likely; deeply positive funding
 * means longs are overcrowded and a long-squeeze (price drop) is likely. This strategy fades that
 * crowding, but only in the direction of the prevailing trend, so it buys panic-short bounces in
 * uptrends and sells euphoric-long tops in downtrends — a source of return buy-and-hold does not have.
 * When it buys and sells: it goes long when funding is far below its own recent average (shorts
 * crowded) while price is above the 200-bar average; it goes short when funding is far above its own
 * average (longs crowded) while price is below the 200-bar average. It exits when funding reverts to
 * neutral, price crosses the 200-bar average against it, or price moves 3xATR against entry.
 * When it does NOT work: in a strong clean trend with no crowding reversals, funding stays one-sided
 * and the contrarian trigger rarely fires — the strategy sits out profitable trends. In a violent
 * crash, deeply negative funding can persist while price keeps falling, so the 3xATR stop is essential.
 */

// z-score of the current funding rate vs its own trailing history (positioning extremes)
function fundingZ(ctx) {
  if (!ctx.state) ctx.state = {};
  const st = ctx.state;
  let hist = Array.isArray(st.fundHist) ? st.fundHist : [];
  const f = ctx.funding;
  if (f == null) return null;
  if (hist.length === 0 || Math.abs(hist[hist.length - 1] - f) > 1e-12) {
    hist.push(f);
    if (hist.length > 90) hist.splice(0, hist.length - 90);
    st.fundHist = hist;
  }
  if (hist.length < 30) return null; // need ~30 bars of funding before the regime is meaningful
  const n = hist.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += hist[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (hist[i] - mean) * (hist[i] - mean);
  const sd = Math.sqrt(v / n);
  if (sd < 1e-12) return 0;
  return (hist[n - 1] - mean) / sd;
}

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const fz = fundingZ(ctx);
  const fzShow = fz == null ? 0 : fz;

  // risk 2% of equity per trade at a 3xATR stop distance
  const qty = (ctx.cash * 0.02) / (3 * atr);

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry - 3 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend down exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: price, trigger: 'below', note: 'Funding reverted',
        conds: [{ label: 'Funding z', now: fzShow, op: '>', ref: -0.2, closed: true }] }
    ]);
    if (fz != null && fz > -0.2) return { side: 'sell', qty: pos, reduceOnly: true }; // shorts no longer crowded -> squeeze done
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx;
    const stopPx = (entry != null) ? entry + 3 * atr : price * 1.15;
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Trend up exit' },
      { side: 'buy', price: stopPx, trigger: 'above', note: '3xATR stop' },
      { side: 'buy', price: price, trigger: 'above', note: 'Funding reverted',
        conds: [{ label: 'Funding z', now: fzShow, op: '<', ref: 0.2, closed: true }] }
    ]);
    if (fz != null && fz < 0.2) return { side: 'buy', qty: -pos, reduceOnly: true }; // longs no longer crowded -> squeeze done
    if (prevClose > sma200) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose >= stopPx) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // contrarian entries: fade crowding, but only with the trend
  const longEntry = (fz != null && fz < -1.2) && prevClose > sma200; // shorts crowded + uptrend
  const shortEntry = (fz != null && fz > 1.2) && prevClose < sma200; // longs crowded + downtrend

  if (longEntry) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Short-squeeze long',
        conds: [{ label: 'Funding z', now: fzShow, op: '<', ref: -1.2, closed: true }] }
    ]);
    return { side: 'buy', qty };
  }
  if (shortEntry) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Long-squeeze short',
        conds: [{ label: 'Funding z', now: fzShow, op: '>', ref: 1.2, closed: true }] }
    ]);
    return { side: 'sell', qty };
  }
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'Short-squeeze long',
      conds: [{ label: 'Funding z', now: fzShow, op: '<', ref: -1.2, closed: true }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'Long-squeeze short',
      conds: [{ label: 'Funding z', now: fzShow, op: '>', ref: 1.2, closed: true }] }
  ]);
  return null;
}
