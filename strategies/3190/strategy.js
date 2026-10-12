/*
 * @coinsori-strategy v1
 * name: BTC 4H Macro-Gated Trend
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto rallies happen when the US dollar is not spiking (risk-on).
 * A 50-EMA trend catches the move, while a DXY filter blocks entries only during sharp
 * USD-strength episodes (e.g. Fed-hike panics) that crush crypto even in an uptrend.
 * When it buys and sells: Buy when price is above its 50-EMA and DXY is not more than 3%
 * above its own recent average. Sell when price drops back below the 50-EMA.
 * When it does NOT work: In a liquidity-driven melt-up where DXY also rises, the gate
 * keeps us out and we miss gains. In flat chop the 50-EMA cross whipsaws.
 */
function onUpdate(ctx) {
  // 2025-01-01: display-only ctx.watch added; trading logic unchanged.
  const ema50 = ctx.ema(50, 1);
  if (ema50 == null) return null;
  const closes = ctx.closes;
  if (closes.length < 2) return null;
  const prevClose = closes[closes.length - 2];

  // --- DXY regime buffer (macro gate) ---
  const st = ctx.state;
  if (!st.dxyHist) st.dxyHist = [];
  const dxyNow = ctx.macro('dxy');
  if (dxyNow != null) {
    st.dxyHist.push(dxyNow);
    if (st.dxyHist.length > 100) st.dxyHist.shift();
  }
  // Gate blocks only when DXY is sharply above its own average (>3%) — loose enough to
  // let normal USD strength through, tight enough to skip spike regimes.
  let riskOn = true;
  if (st.dxyHist.length >= 20) {
    let sum = 0;
    for (let i = 0; i < st.dxyHist.length; i++) sum += st.dxyHist[i];
    const avg = sum / st.dxyHist.length;
    riskOn = dxyNow == null || dxyNow < avg * 1.03;
  }

  if (ctx.position > 0 && prevClose < ema50) {
    ctx.watch([{ side: 'sell', price: ema50, trigger: 'below', note: '50-EMA exit', qty: ctx.position }]);
    return { side: 'sell', qty: ctx.position };
  }
  if (ctx.position === 0 && prevClose > ema50 && riskOn) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: '50-EMA entry', conds: [{ label: 'DXY risk-on', ok: riskOn }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position === 0) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: '50-EMA entry' }]);
  } else {
    ctx.watch([{ side: 'sell', price: ema50, trigger: 'below', note: '50-EMA exit' }]);
  }
  return null;
}
