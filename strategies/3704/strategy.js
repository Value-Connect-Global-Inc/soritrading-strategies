/*
 * @coinsori-strategy v1
 * name: MomentumRotationTop1
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in crypto, strength persists — the asset with the best
 * recent momentum tends to keep outperforming. Instead of timing each asset on
 * its own, this strategy ranks the basket by 20-day momentum and holds ONLY the
 * strongest asset (rotation). It never fights the leader and never holds a
 * laggard, so the whole book is concentrated in whatever is working.
 * When it buys and sells: each bar it compares the 20-day return of BTC, ETH
 * and BNB. Buy an asset only when it is the top-ranked AND price is above both
 * the 50-day and 200-day averages. Sell when it loses the top rank, closes
 * below the 50-day average, or hits a 2x ATR stop below entry. Position sized
 * to risk 1% of equity via the 2x ATR stop.
 * When it does NOT work: when all three assets fall together (a broad crypto
 * bear) the top rank still falls and the 50-day exit gets out late. In a market
 * where leadership flips every few weeks, rotation churns and pays fees on
 * every switch. Concentration in one asset means a single bad pick is the whole
 * book (though the 1% risk cap bounds the damage).
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null || atr <= 0) return null;

  const prevClose = ctx.closes.at(-2);
  const mom20Close = ctx.closes.at(-22);
  if (prevClose == null || mom20Close == null || mom20Close <= 0) { ctx.watch([]); return null; }
  const mom20 = prevClose / mom20Close - 1; // 20-day return on CLOSED bars

  // Shared state across all symbols (see 3133 pattern). Store this symbol's
  // momentum tagged with the bar so stale entries from other symbols are ignored.
  const st = ctx.state;
  if (st.mom == null) st.mom = {};
  if (st.momBar == null) st.momBar = {};
  st.mom[sym] = mom20;
  st.momBar[sym] = ctx.i;

  // Rank against every symbol in the run, using values from this bar or the
  // previous one (symbols update sequentially within a bar, so allow 1-bar lag).
  const basket = (ctx.syms && ctx.syms.length) ? ctx.syms : [sym];
  let bestSym = sym;
  let bestMom = mom20;
  for (const s of basket) {
    const m = st.mom[s];
    const mb = st.momBar[s];
    if (m == null || mb == null || mb < ctx.i - 1) continue; // ignore stale
    if (m > bestMom) { bestMom = m; bestSym = s; }
  }
  const isTop = bestSym === sym;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Rotate out when this asset loses the top rank, breaks trend, or hits stop.
    if (price <= hardStop || prevClose < sma50 || !isTop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Volatility-targeted size: risk 1% of equity via a 2x ATR stop, capped at
  // 40% of equity so a low-vol leader cannot over-leverage the book.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  // Entry: this asset is the top-ranked by momentum AND in an uptrend.
  if (isTop && prevClose > sma200 && prevClose > sma50) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'top momentum', ok: isTop }] }]);
  return null;
}
