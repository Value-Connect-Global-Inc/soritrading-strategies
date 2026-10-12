/*
 * @coinsori-strategy v1
 * name: DollarRegimeTrendRider
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the US dollar index (DXY) is the macro tide crypto floats
 * on. When the dollar weakens, risk assets like crypto tend to trend up; when
 * the dollar strengthens, crypto tends to fall. This strategy rides crypto
 * uptrends but only while the dollar is on the weak side of its own 40-day
 * average, and exits when the dollar turns clearly strong. It is a macro-regime
 * filter on top of a simple trend core — a different edge than the price-only
 * champion and the volatility-targeting rider.
 * When it buys and sells: buy when a close is above both the 50-day and 200-day
 * averages AND the dollar index is below its own 40-day average (weak dollar).
 * Sell when the close drops below the 50-day average, price hits a 2x ATR stop,
 * or the dollar index rises clearly above its 40-day average (risk-off). Each
 * position is sized to risk 1% of equity via a 2x ATR stop (volatility target).
 * When it does NOT work: whenever crypto rallies while the dollar is flat or
 * rising (crypto-specific drivers like ETFs, halvings, regulation), the filter
 * keeps it in cash and it misses the move. In a choppy market where DXY wiggles
 * around its average, the regime gate can flip on and off and cause whipsaws.
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

  // Rolling DXY history in state (ctx.data has no history access). 40 days.
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  if (st.dxyBar !== ctx.i) {
    st.dxyHist.push(dxy);
    if (st.dxyHist.length > 40) st.dxyHist.shift();
    st.dxyBar = ctx.i;
  }
  if (st.dxyHist.length < 40) return null;
  const dxySma = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on trend break, hard stop, or dollar turning clearly strong (DXY
    // more than 0.5% above its 40-day average). The 0.5% band is hysteresis so
    // a daily DXY wiggle does not yank us out of a good trend.
    if (price <= hardStop || prevClose < sma50 || dxy > dxySma * 1.005) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Volatility-targeted size: risk 1% of equity per position via a 2x ATR
  // stop, capped at 40% of equity so a low-vol coin cannot over-leverage.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  // Entry: uptrend (close > 50d and 200d) AND weak dollar (DXY below its own
  // 40-day average). Both must hold on the closed bar.
  if (prevClose > sma200 && prevClose > sma50 && dxy < dxySma) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'DXY < 40d avg', now: dxy, op: '<', ref: dxySma, closed: true }] }]);
  return null;
}
