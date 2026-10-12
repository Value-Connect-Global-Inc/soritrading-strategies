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
 * uptrends but only enters while the dollar is in a structural downtrend (DXY
 * below its own 200-day average). A slow 200-day regime is used instead of a
 * fast one so short-term DXY spikes do not keep the strategy out of a real
 * rally. Once in, exits are managed purely by price.
 * When it buys and sells: buy when a close is above both the 50-day and 200-day
 * averages AND the dollar index is below its own 200-day average (structural
 * dollar weakness). Sell when the close drops below the 50-day average or price
 * hits a 2x ATR stop below entry. Each position is sized to risk 1% of equity
 * via the 2x ATR stop (volatility target).
 * When it does NOT work: whenever crypto rallies while the dollar is flat or
 * rising (crypto-specific drivers like ETFs, halvings, regulation), the filter
 * keeps it in cash and it misses the move. The 200-day DXY regime is slow, so
 * it can still be "weak dollar" at the very start of a dollar reversal and let
 * the strategy buy into a nascent crypto bear. A hard 2x ATR stop means a
 * sudden gap can still lose more than the planned 1%.
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

  // Rolling DXY history in state (ctx.data has no history access). 200 days.
  const st = ctx.state;
  if (st.dxyHist == null) st.dxyHist = [];
  if (st.dxyBar !== ctx.i) {
    st.dxyHist.push(dxy);
    if (st.dxyHist.length > 200) st.dxyHist.shift();
    st.dxyBar = ctx.i;
  }
  if (st.dxyHist.length < 200) return null;
  const dxySma = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit is PURELY price-based: trend break or hard stop. No DXY exit — a
    // slow macro signal must not cut a winning trend short.
    if (price <= hardStop || prevClose < sma50) {
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

  // Entry: uptrend (close > 50d and 200d) AND structural dollar weakness
  // (DXY below its own 200-day average). Both must hold on the closed bar.
  if (prevClose > sma200 && prevClose > sma50 && dxy < dxySma) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'DXY < 200d avg', now: dxy, op: '<', ref: dxySma, closed: true }] }]);
  return null;
}
