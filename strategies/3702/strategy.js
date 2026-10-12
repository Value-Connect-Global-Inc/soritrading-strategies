/*
 * @coinsori-strategy v1
 * name: FedEasingTrend
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is a liquidity asset — its biggest bull markets
 * (2017, 2020-21) happened while the Fed was cutting rates or holding them low.
 * The Fed funds rate is a slow step-function signal, so it is a stable regime
 * filter: it tells us whether the monetary tide is loose (risk-on) or tight
 * (risk-off) without the noise of price patterns. This strategy rides crypto
 * uptrends but only enters while the Fed funds rate is below its own 90-day
 * average (rate falling or already low = easing/loose policy).
 * When it buys and sells: buy when a close is above both the 50-day and 200-day
 * averages AND the Fed funds rate is below its own 90-day average (loose
 * policy). Sell when the close drops below the 50-day average or price hits a
 * 2x ATR stop below entry. Each position is sized to risk 1% of equity via the
 * 2x ATR stop (volatility target).
 * When it does NOT work: crypto can rally during tight policy too (e.g. a
 * halving-driven or ETF-driven pump) and this strategy misses those. The Fed
 * only changes rates a few times a year, so the regime switch is slow and can
 * still be "loose" at the very start of a hiking cycle. A hard 2x ATR stop
 * means a sudden gap can lose more than the planned 1%.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const fed = Number(ctx.data('fed_lag30')); // Fed funds rate, lagged 30 days to avoid lookahead
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (!Number.isFinite(fed) || fed <= 0 || sma200 == null || sma50 == null || atr == null || atr <= 0) return null;

  // Rolling Fed history in state (ctx.data has no history access). 90 days.
  const st = ctx.state;
  if (st.fedHist == null) st.fedHist = [];
  if (st.fedBar !== ctx.i) {
    st.fedHist.push(fed);
    if (st.fedHist.length > 90) st.fedHist.shift();
    st.fedBar = ctx.i;
  }
  if (st.fedHist.length < 90) return null;
  const fedSma = st.fedHist.reduce((a, b) => a + b, 0) / st.fedHist.length;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit is PURELY price-based: trend break or hard stop. The slow Fed
    // regime must not cut a winning trend short mid-cycle.
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

  // Entry: uptrend (close > 50d and 200d) AND loose monetary policy (Fed
  // funds rate below its own 90-day average). Both must hold on the closed bar.
  if (prevClose > sma200 && prevClose > sma50 && fed < fedSma) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'Fed rate < 90d avg', now: fed, op: '<', ref: fedSma, closed: true }] }]);
  return null;
}
