/*
 * @coinsori-strategy v1
 * name: MomentumRotationTop2
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in crypto, strength persists — the assets with the best
 * recent momentum tend to keep outperforming. Instead of timing each asset on
 * its own, this strategy ranks the basket by 60-day momentum and holds the
 * TOP TWO of the three assets (BTC, ETH, BNB), skipping the laggard. A slow
 * 60-day signal plus a hysteresis band stops the churn a fast rotation causes.
 * Holding two leaders instead of one captures more of a broad bull while still
 * avoiding the weakest asset.
 * When it buys and sells: each bar it ranks BTC, ETH and BNB by 60-day return.
 * Buy an asset when it is ranked 1st or 2nd (within 5% of the leader on the
 * 2nd place) AND price is above both the 50-day and 200-day averages. Sell
 * when it drops to last place, closes below the 50-day average, or hits a 2x
 * ATR stop below entry. Each position sized to risk 1% of equity via the 2x
 * ATR stop.
 * When it does NOT work: when all three assets fall together (a broad crypto
 * bear) even the 2nd-ranked asset falls and the 50-day exit gets out late. In
 * a market where leadership flips every few weeks, rotation switches and pays
 * fees. A hard 2x ATR stop means a sudden gap can lose more than the planned 1%.
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
  const momClose = ctx.closes.at(-62);
  if (prevClose == null || momClose == null || momClose <= 0) { ctx.watch([]); return null; }
  const mom = prevClose / momClose - 1; // 60-day return on CLOSED bars

  // Shared state across all symbols. Store this symbol's momentum tagged with
  // the bar so stale entries from other symbols are ignored.
  const st = ctx.state;
  if (st.mom == null) st.mom = {};
  if (st.momBar == null) st.momBar = {};
  st.mom[sym] = mom;
  st.momBar[sym] = ctx.i;

  const basket = (ctx.syms && ctx.syms.length) ? ctx.syms : [sym];
  // Collect this bar's momentum for every symbol (allow 1-bar lag for symbols
  // that update later in the same bar).
  let bestMom = -Infinity;
  let secondMom = -Infinity;
  for (const s of basket) {
    const m = st.mom[s];
    const mb = st.momBar[s];
    if (m == null || mb == null || mb < ctx.i - 1) continue; // ignore stale
    if (m > bestMom) { secondMom = bestMom; bestMom = m; }
    else if (m > secondMom) { secondMom = m; }
  }
  // Top-2 membership: this asset is 1st, or 2nd and within 5% of the leader.
  // The 5% band only matters at the 1st/2nd boundary — it stops a coin-flip
  // switch between two almost-equal leaders.
  const isTop2 = (mom >= secondMom * 0.95 && mom > 0);

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Rotate out when this asset drops out of top-2, breaks trend, or hits stop.
    if (price <= hardStop || prevClose < sma50 || !isTop2) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  // Volatility-targeted size: risk 1% of equity per position via a 2x ATR
  // stop, capped at 40% of equity so a low-vol leader cannot over-leverage.
  const riskPerTrade = 0.01 * ctx.cash;
  let qty = riskPerTrade / (2 * atr);
  const maxQty = (ctx.cash / price) * 0.40;
  qty = Math.min(qty, maxQty);

  if (isTop2 && prevClose > sma200 && prevClose > sma50) {
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry',
               conds: [{ label: 'close>200d', ok: prevClose > sma200 },
                       { label: 'top-2 momentum', ok: isTop2 }] }]);
  return null;
}
