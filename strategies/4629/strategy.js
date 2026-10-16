/*
 * @coinsori-strategy v1
 * name: On-Chain Demand Momentum + Profit-Lock Exit 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Network usage is a demand proxy. Rallies backed by growing
 * daily active addresses are more durable than rallies on thin usage — new users
 * coming in are what actually pushes price. So we only buy when BOTH price
 * momentum is positive AND on-chain usage is expanding relative to its own 30-day
 * average. The exit adds a profit-lock rule: once a position is up 50% or more, a
 * 25% trailing stop below the run high protects the gain, so a big winner is not
 * ridden all the way back down before the slow 200-day trend exit fires.
 * When it buys and sells: buy when the last closed bar sits above the 200-day EMA,
 * its 30-day return is positive, and daily active addresses are above their 30-day
 * average (network expanding). Sell when price closes below the 200-day EMA, the
 * 30-day return turns negative, the 15% hard stop is hit, or — once the position
 * is up 50% — price falls 25% below its highest close since entry.
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
    const entry = ctx.entryPx;
    const hardStop = entry && entry > 0 ? entry * 0.85 : 0;   // hard stop: 15% below entry
    // profit-lock: only after a 50% gain does a 25% trail from the run high engage.
    // before that the 15% hard stop is the only stop, so normal bull pullbacks
    // (20-30%) do NOT churn us out of a young position.
    const gain = entry && entry > 0 ? price / entry - 1 : 0;
    const st = ctx.state || {};
    const peak = st.peak && st.peak > 0 ? st.peak : prevClose;
    const newPeak = Math.max(peak, prevClose);
    st.peak = newPeak;
    const trailStop = gain > 0.5 ? newPeak * 0.75 : 0;   // 25% below the run high
    const stop = Math.max(hardStop, trailStop);
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'stop (hard or profit-lock)' },
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
  st.peak = prevClose;   // reset the run-high peak at a fresh entry
  return { side: 'buy', qty };
}
