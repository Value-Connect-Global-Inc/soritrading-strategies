/*
 * @coinsori-strategy v1
 * name: DXY-Gated BTC Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades inversely to the US dollar — when the dollar is
 * weakening, risk appetite rises and BTC tends to rally. This adds a macro regime
 * filter on top of a simple trend: only buy BTC when the trend (price above 200-day
 * EMA) AND the dollar's own momentum (DXY falling over the last 5 days) agree.
 * A different family from the hashrate champion — no on-chain data, pure macro + price.
 * When it buys and sells: buys when price closes above the 200-day EMA AND the dollar
 * index has fallen over the last 5 days (dollar weakening). Sells when price closes
 * below the 200-day EMA or a 2.5x ATR hard stop hits.
 * When it does NOT work: in a strong-dollar regime it sits in cash and misses BTC
 * rallies; DXY is business-days-only so weekends carry the Friday value. In a crash
 * where the dollar also weakens (2020), the gate does not protect — the trend and
 * stop must do that.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  // DXY history: accumulate daily values, carry Friday into the weekend
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  const dxyRaw = ctx.data('dxy');
  const dxyNow = dxyRaw == null ? null : Number(dxyRaw);   // ctx.data can return a string — coerce
  if (dxyNow != null && Number.isFinite(dxyNow) && dxyNow > 0) st.dxyHist.push(dxyNow);
  if (st.dxyHist.length > 30) st.dxyHist.shift();
  if (st.dxyHist.length < 6) return null;
  const dxyPrev5 = st.dxyHist[st.dxyHist.length - 6];
  const dollarFalling = dxyNow != null && dxyNow < dxyPrev5;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'falling dollar + uptrend',
               conds: [{ label: 'DXY falling 5d', ok: dollarFalling, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !dollarFalling) return null;

  const riskCash = ctx.cash * 0.02;         // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
