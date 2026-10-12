/*
 * @coinsori-strategy v1
 * name: DollarRegimeTrendRider
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the US dollar index (DXY) is the macro tide crypto floats
 * on. When the dollar turns clearly strong, crypto tends to fall, so DXY is a
 * risk-off exit on top of a simple uptrend core. The wide band and cooldown
 * stop the whipsaw that a tight DXY exit caused in earlier testing.
 * When it buys and sells: buy when a close is above both the 50-day and 200-day
 * averages. Sell when the close drops below the 50-day average, price hits a
 * 2x ATR stop, or the dollar index rises more than 1.5% above its 40-day
 * average (clear risk-off). After a DXY exit, wait 10 bars before re-entering.
 * Each position is sized to risk 1% of equity via a 2x ATR stop.
 * When it does NOT work: whenever crypto rallies while the dollar is strong
 * (crypto-specific drivers like ETFs, halvings, regulation), the exit filter
 * can cut a winning trend early. In a choppy market where DXY oscillates
 * around its average, the regime gate still causes some whipsaws.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const dxy = Number(ctx.data('dxy'));
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (!Number.isFinite(dxy) || dxy <= 0 || sma200 == null || sma50 == null || atr == null || atr <= 0) return null;

  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  if (st.dxyBar !== ctx.i) {
    st.dxyHist.push(dxy);
    if (st.dxyHist.length > 40) st.dxyHist.shift();
    st.dxyBar = ctx.i;
  }
  if (st.dxyHist.length < 40) return null;
  const dxySma = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;
  const riskOff = dxy > dxySma * 1.015; // clear dollar strength, not a wiggle

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < sma50 || riskOff) {
      if (riskOff) st.dxyExitBar = ctx.i; // remember when we left for the cooldown
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // 10-bar cooldown after a DXY risk-off exit prevents immediate re-entry
  // churn (the failure mode of the previous version).
  if (st.dxyExitBar != null && ctx.i - st.dxyExitBar < 10) {
    ctx.watch([{ side: 'buy', at: 0, note: 'cooldown after DXY exit' }]);
    return null;
  }

  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  if (prevClose > sma200 && prevClose > sma50) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 }] }]);
  return null;
}
