/*
 * @coinsori-strategy v1
 * name: DXY Regime Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is an inflation hedge and a risk asset, so it tends
 * to rally when the US dollar is falling and to struggle when the dollar is
 * rising. We combine that macro regime with a long-term trend filter: only buy
 * when BTC is above its 200-day EMA AND the dollar has been falling over the
 * last 5 days.
 * When it buys and sells: buys when the previous close is above the 200-day EMA
 * AND the 5-day change of the trade-weighted dollar index is negative (dollar
 * weakening). Sells when price closes below the 200-day EMA or a 2.5x ATR hard
 * stop is hit. Stays in cash when the dollar is rising.
 * When it does NOT work: dollar regime is a slow filter — in a BTC bull driven
 * by pure crypto liquidity (not dollar weakness) it misses part of the rally,
 * and it can be late into a crash. It is a macro signal, so it adds nothing in
 * a dollar-neutral move. DXY is business-days only, so the series has small
 * gaps on weekends — handled by rolling history.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  // Dollar regime: 5-day change of the trade-weighted dollar index
  const dxy = ctx.data('dxy');
  const dxyVal = dxy == null ? null : Number(dxy);
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  if (dxyVal != null && Number.isFinite(dxyVal) && dxyVal > 0) {
    st.dxyHist.push(dxyVal);
    if (st.dxyHist.length > 10) st.dxyHist.shift();
  }
  if (st.dxyHist.length < 6) return null;
  const dxyPrev5 = st.dxyHist[st.dxyHist.length - 6];
  const dxyChange5 = dxyVal - dxyPrev5;   // positive = dollar strengthening

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
  const weakDollar = dxyChange5 < 0;   // dollar falling over last 5 days
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'weak dollar + uptrend',
               conds: [{ label: 'DXY 5d falling', ok: weakDollar, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !weakDollar) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
