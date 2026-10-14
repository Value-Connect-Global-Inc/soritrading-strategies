/*
 * @coinsori-strategy v1
 * name: FearGreed Dip-Buy BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) measures crowd sentiment.
 * When the crowd is fearful the price is often marked down below fair value; when
 * greedy it is often stretched. Buying fear inside a confirmed uptrend captures
 * pullbacks while the 200-day EMA guard keeps it out of bear markets. This is a
 * sentiment/behavioral axis, different from the DXY macro filter and the hashrate
 * on-chain champion.
 * When it buys and sells: buys when the index is below 30 (fearful crowd) AND the
 * previous close is above the 200-day EMA (uptrend intact). Sells when the index
 * reaches 75 (greedy crowd), when price closes below the 200-day EMA, or when a
 * 2x ATR hard stop is hit.
 * When it does NOT work: in a slow grind down the index can read "fearful" while
 * price keeps falling below the EMA — the trend guard keeps it in cash but it
 * misses the eventual bottom. In a straight-up euphoric bull it exits early at
 * greed 75 and re-enters on the next fear dip, so it lags a buy-and-hold.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  // Accumulate daily Fear & Greed values (0-100) into a rolling history
  const st = ctx.state;
  if (st.fgHist == null) st.fgHist = [];
  const fgRaw = ctx.data('fear_greed');
  const fg = fgRaw == null ? null : Number(fgRaw);
  if (fg != null && Number.isFinite(fg) && fg >= 0) st.fgHist.push(fg);
  if (st.fgHist.length > 30) st.fgHist.shift();
  if (st.fgHist.length < 3) return null;
  const fgNow = st.fgHist[st.fgHist.length - 1];
  const fgPrev = st.fgHist[st.fgHist.length - 2];   // last CLOSED day's sentiment

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2 * atr;   // hard stop: 2x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    if (fgPrev != null && fgPrev >= 75) return { side: 'sell', qty: pos }; // take profit on greed
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' },
               { side: 'sell', note: 'sell when F&G >= 75',
                 conds: [{ label: 'F&G prev day', now: fgPrev, op: '>=', ref: 75, closed: true }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  const fearful = fgPrev != null && fgPrev < 30;   // buy fear, not greed
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'fear dip in uptrend',
               conds: [{ label: 'F&G prev day', now: fgPrev, op: '<', ref: 30, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !fearful) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
