/*
 * @coinsori-strategy v1
 * name: Address Adoption Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price is ultimately driven by real network usage.
 * Rising unique active addresses mean more people actually using the network —
 * a sign of genuine adoption, distinct from the hashrate (mining power) signal.
 * This strategy only buys when the long-term trend is up AND network usage is
 * expanding, so it rides rallies backed by real adoption and skips price spikes
 * with no usage behind them.
 * When it buys and sells: buys when the previous close is above the 200-day EMA
 * AND the 30-day smoothed active-address count is higher than it was 10 days ago
 * (usage expanding). Sells when price closes below the 200-day EMA or a 2.5x ATR
 * hard stop is hit.
 * When it does NOT work: active addresses are a slow, noisy series — in a
 * speculative bull with no usage growth it stays in cash and misses the rally;
 * in a crash where usage collapses it can exit late. It is an on-chain signal,
 * so it adds nothing in a pure macro-driven move (e.g. a liquidity shock).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  // Active-address usage: 30-day smoothed level vs its own level 10 days ago
  const st = ctx.state;
  if (st.addrHist == null) st.addrHist = [];
  const addrNow = ctx.data('addr_sma30');
  const addrVal = addrNow == null ? null : Number(addrNow);
  if (addrVal != null && Number.isFinite(addrVal) && addrVal > 0) {
    st.addrHist.push(addrVal);
    if (st.addrHist.length > 30) st.addrHist.shift();
  }
  if (st.addrHist.length < 11) return null;
  const addrPrev = st.addrHist[st.addrHist.length - 11];

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  const usageExpanding = addrVal > addrPrev;   // adoption growing over 10 days
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'usage expanding + uptrend',
               conds: [{ label: 'addr30 rising 10d', ok: usageExpanding, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !usageExpanding) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
