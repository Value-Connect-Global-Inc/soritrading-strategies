/*
 * @coinsori-strategy v1
 * name: On-Chain Demand Momentum 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Network usage is a demand proxy. Rallies backed by growing
 * daily active addresses are more durable than rallies on thin usage — new users
 * coming in are what actually pushes price. So we only buy when BOTH price
 * momentum is positive AND on-chain usage is expanding relative to its own 30-day
 * average, and we sell when the trend, the momentum, or a trailing stop cuts the
 * ride short so we do not give back the whole move.
 * When it buys and sells: buy when the last closed bar sits above the 200-day EMA,
 * its 30-day return is positive, and daily active addresses are above their 30-day
 * average (network expanding). Sell when price closes below the 200-day EMA, the
 * 30-day return turns negative, the 15% hard stop is hit, or price falls 20% below
 * its highest close since entry (trailing stop).
 * When it does NOT work: active-address data is published with a lag and can stay
 * elevated after a top (usage peaks while price is still falling), so the filter
 * gives a false sense of support in early bear phases; and in a pure liquidity-
 * driven rally with no new users (e.g. stablecoin inflow pumps) it keeps you out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of last CLOSED bar

  // on-chain demand: active addresses vs their own 30-day average.
  // null = not ready / dataset missing -> fall back to price-only (no false block).
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const networkUp = addr == null || addrSma == null ? null : addr > addrSma;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // trailing stop: track the highest close since entry in persistent state.
    const st = ctx.state || {};
    const peak = st.peak && st.peak > 0 ? st.peak : prevClose;
    const newPeak = Math.max(peak, prevClose);
    st.peak = newPeak;
    const trailStop = newPeak * 0.80;   // exit if price falls 20% from the run high — locks in gains
    const entry = ctx.entryPx;
    const hardStop = entry && entry > 0 ? entry * 0.85 : 0;   // 15% below entry
    if (price <= hardStop || price <= trailStop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: Math.max(hardStop, trailStop), trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  // network filter: only enter when usage is expanding (or data unavailable)
  if (networkUp === false) return null;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'addr > 30d avg', ok: networkUp !== false, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin bigger, wild coin smaller
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  const st = ctx.state || {};
  st.peak = prevClose;   // reset the trailing peak at a fresh entry
  return { side: 'buy', qty };
}
