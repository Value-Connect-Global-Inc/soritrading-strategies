/*
 * @coinsori-strategy v1
 * name: HashrateRegimeTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin miners only add computing power (hashrate) when mining is profitable —
 * a rising hashrate is a slow, hard-to-fake sign the network is being valued up, and hashrate
 * contractions have historically lined up with bear markets. We ride BTC's long-term trend only
 * while the network is expanding.
 * When it buys and sells: Buys when the daily close is above the 200-day average AND network hashrate
 * is above its own 30-day average. Sells when either condition breaks, or a hard 2xATR stop is hit.
 * When it does NOT work: In a bull run that starts on hype before miners expand capacity, the
 * hashrate gate keeps us out of early gains (we enter late). In a long sideways range above the
 * 200-day average the strategy holds through chop and gives back gains.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  if (ctx.closes.length < 202) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  // Onchain regime gate: hashrate above its 30-day average = miners expanding (slow, smooth signal).
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const hrUp = (hr != null && hrSma != null) ? hr > hrSma : false;

  const pos = ctx.position || 0;

  // Hard stop on every position: 2x ATR below entry (1d bars can gap).
  if (pos > 0 && ctx.entryPx != null) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (px < stopPx) return { side: 'sell', qty: pos };
  }

  const lastClose = ctx.closes.at(-2);
  if (lastClose == null) return null;

  if (pos > 0) {
    // Exit when the long-term trend breaks, or miners stop expanding (network value falling).
    if (lastClose < ema200 || !hrUp) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: '200d avg break' },
      { side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return null;
  }

  // Entry: long-term uptrend (close > 200d avg) confirmed by network expansion.
  if (lastClose > ema200 && hrUp) {
    const risk = 0.02 * ctx.cash;
    const stopDist = 2 * atr;
    const qty = risk / stopDist;
    if (qty <= 0) return null;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: '200d avg break' },
      { side: 'sell', price: px - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: '200d avg + hashrate up' }]);
  return null;
}
