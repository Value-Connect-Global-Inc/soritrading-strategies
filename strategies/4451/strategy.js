/*
 * @coinsori-strategy v1
 * name: Multi-Asset Momentum + Portfolio Crash Brake 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion momentum rule works, but its own header admits
 * the weak point — all crypto majors are correlated, so in a broad crash every
 * leg falls together and the basket behaves like one coin. This version keeps the
 * exact champion entries (200-day EMA + 30-day momentum, volatility-targeted
 * sizing) and adds a PORTFOLIO circuit breaker: when the whole book is down 15%
 * from its equity peak, every leg sells at once instead of waiting for each leg's
 * individual 15% stop. It only re-enters after the book has recovered to within
 * 5% of that peak, so it never buys a falling knife after a crash.
 * When it buys and sells: a leg buys when its previous close is above the 200-day
 * EMA AND its 30-day return is positive AND the portfolio is near its equity peak.
 * It sells on the 15% per-leg stop, the 200-day EMA break, fading 30-day momentum,
 * or the portfolio 15% crash brake.
 * When it does NOT work: in a choppy market the 30-day return flips sign and it
 * whipsaws; after a V-shaped crash it exits at the bottom and re-enters a few
 * percent higher, giving back part of the bounce. It also sits in cash through
 * long sideways markets, earning nothing.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // ---- portfolio equity: cash + every held leg marked at its current price ----
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (Array.isArray(positions)) {
    for (const p of positions) {
      if (p == null || p.qty == null || p.qty <= 0) continue;
      const m = ctx.market(p.sym);
      const px = (m != null && typeof m === 'object' && m.price != null) ? m.price : m;
      if (typeof px === 'number' && px > 0) equity += p.qty * px;
    }
  }

  // shared peak-equity and brake state (ctx.state is ONE object for all symbols)
  const st = ctx.state;
  if (st.peakEq == null || equity > st.peakEq) st.peakEq = equity;
  const brake = st.peakEq > 0 && equity < st.peakEq * 0.85;      // book down 15% from peak
  const recovered = st.peakEq > 0 && equity >= st.peakEq * 0.95; // back within 5% of peak

  // volatility-targeted sizing: ~2% daily vol per leg
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;        // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    if (brake) return { side: 'sell', qty: pos };                // portfolio crash brake
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'portfolio brake', ok: !brake, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'portfolio near peak', ok: recovered, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;
  if (!recovered) return null;   // crash brake still on: no new entries

  const targetCash = ctx.cash * 0.33 * volScale;  // 1/3 of pool per leg, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
