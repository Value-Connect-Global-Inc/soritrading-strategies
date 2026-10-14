/*
 * @coinsori-strategy v1
 * name: Fed Regime Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is highly sensitive to US monetary policy — the
 * 2022 bear was driven by the Fed hiking rates, and rallies tend to start when
 * policy stops tightening. We ride the long-term trend and only skip entries
 * while the Fed is in a sharp hiking phase.
 * When it buys and sells: buys when the previous close is above the 200-day EMA
 * AND the effective fed funds rate has risen less than 0.25pp over the last 30
 * days (not in a sharp tightening). Sells when price closes below the 200-day
 * EMA or a 2.5x ATR hard stop is hit.
 * When it does NOT work: in a bull driven by liquidity with rates already low
 * and flat it stays fully invested, but a rate cut that starts while price is
 * still below the 200-day EMA is ignored, so it is late into post-crash
 * recoveries. Fed funds is business-days only — handled by rolling history.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  // Fed regime: 30-day change of the effective fed funds rate
  const fed = ctx.data('fed');
  const fedVal = fed == null ? null : Number(fed);
  const st = ctx.state;
  if (st.fedHist == null) st.fedHist = [];
  if (fedVal != null && Number.isFinite(fedVal) && fedVal >= 0) {
    st.fedHist.push(fedVal);
    if (st.fedHist.length > 40) st.fedHist.shift();
  }
  if (st.fedHist.length < 31) return null;
  const fedPrev30 = st.fedHist[st.fedHist.length - 31];
  const fedChange30 = fedVal - fedPrev30;   // positive = tightening

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
  const noHike = fedChange30 < 0.25;   // skip only sharp 30-day hiking phases
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'uptrend, no hike',
               conds: [{ label: 'fed 30d < +0.25', ok: noHike, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !noHike) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
