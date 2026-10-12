/*
 * @coinsori-strategy v1
 * name: DollarGateTrendBTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the US dollar index (DXY) is the macro tide crypto floats on. When the dollar is
 * in a confirmed downtrend, risk assets like crypto tend to trend up. This rides BTC uptrends but only
 * while the dollar is below its own 100-day average — a slow weak-dollar regime used ONLY as an entry
 * gate. Exits are price-only, so a daily DXY bounce never yanks a good position out.
 * When it buys and sells: buys when a close is above the 50- and 200-day averages AND DXY is below its
 * 100-day average. Sells when the close drops below the 50-day average or price hits a 2x ATR stop.
 * Position sized to risk 1% of equity via the 2x ATR stop, capped at 40% of equity.
 * When it does NOT work: whenever crypto rallies while the dollar is flat or rising (ETF/halving/reg
 * news), the gate keeps it in cash and it misses the move. Choppy markets around the 50-day average churn.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (!Number.isFinite(px) || px <= 0) return null;

  const raw = ctx.data('dxy');
  const dxy = raw == null ? NaN : Number(raw);
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (!Number.isFinite(dxy) || dxy <= 0 || sma200 == null || sma50 == null || atr == null || atr <= 0) return null;

  // Rolling DXY history in state (ctx.data has no history access). 100 days: slow regime signal.
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  if (st.dxyBar !== ctx.i) {
    st.dxyHist.push(dxy);
    if (st.dxyHist.length > 100) st.dxyHist.shift();
    st.dxyBar = ctx.i;
  }
  if (st.dxyHist.length < 100) return null;
  const dxySma = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position || 0;
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exits are price-only: trend break or hard stop. No DXY exit.
    if (px <= hardStop || prevClose < sma50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Vol-targeted size: risk 1% of equity via 2x ATR stop, capped at 40% of equity.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / px) * 0.40;
  qty = Math.min(qty, maxQty);

  // Entry: uptrend AND confirmed weak dollar (DXY below its own 100-day average).
  if (prevClose > sma200 && prevClose > sma50 && dxy < dxySma) return { side: 'buy', qty };
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'DXY < 100d avg', now: dxy, op: '<', ref: dxySma, closed: true }] }]);
  return null;
}
