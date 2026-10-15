/*
 * @coinsori-strategy v1
 * name: Open-Interest Confirmed Trend (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A rally backed by rising open interest means NEW money is
 * entering the market (fresh long positions) — that tends to be a real trend.
 * A rally with falling open interest is old positions being squeezed, which
 * fades fast. We use OI as a confirmation filter on top of a price trend.
 * When it buys and sells: buys when the close is above the 200-day EMA, the
 * 30-day return is positive, and open interest is above its own 30-day average.
 * Sells when the close falls below the 200-day EMA, the 30-day return turns
 * negative, or a 15% hard stop is hit.
 * When it does NOT work: OI is a futures metric and can be missing or stale on
 * some bars — when it is missing we skip the filter so the strategy degrades to
 * a plain trend follower. OI can also rise into a blow-off top, so it is not a
 * reliable exit signal. It does not add protection to other coins.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // rolling 30-day average of open interest, built in state (no precomputed series).
  const st = ctx.state;
  const oi = ctx.binanceOi();
  if (!Array.isArray(st.oiHist)) st.oiHist = [];
  if (oi != null) st.oiHist.push(oi);
  if (st.oiHist.length > 30) st.oiHist.shift();
  let oiRising = true;   // default allow when data missing, so we never silently block
  if (oi != null && st.oiHist.length >= 30) {
    const avg = st.oiHist.reduce((a, b) => a + b, 0) / st.oiHist.length;
    oiRising = oi >= avg;
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'OI above 30d avg', ok: oiRising, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !oiRising) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
