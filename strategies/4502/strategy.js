/*
 * @coinsori-strategy v1
 * name: Dollar-Weak Trend Rider (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset — when the US dollar is
 * weak and global liquidity is easy, money tends to flow into crypto; when the
 * dollar strengthens, that flow reverses. We only buy BTC while both the price
 * trend and the dollar regime point the same way.
 * When it buys and sells: buys when the close is above the 200-day EMA, the
 * 30-day return is positive, and the dollar is below its own 20-day average.
 * Sells when the close falls below the 200-day EMA, the 30-day return turns
 * negative, or a 15% hard stop is hit.
 * When it does NOT work: in a long bull market where the dollar is also strong
 * (e.g. 2017 or parts of 2024-25), the dollar gate keeps us out of big rallies,
 * so it can underperform a pure trend follower. The dollar index is business-
 * days-only, so weekends carry the previous value; when the data is missing the
 * gate is skipped, so it is not a hard filter.
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

  // rolling 20-day average of the dollar index, built in state because the raw
  // dxy series has no precomputed moving-average dataset. Weekend rows are null
  // and simply skipped, so the window is 20 available business days (~4 weeks).
  const st = ctx.state;
  const dxy = ctx.data('dxy');
  if (!Array.isArray(st.dxyHist)) st.dxyHist = [];
  if (dxy != null) st.dxyHist.push(dxy);
  if (st.dxyHist.length > 20) st.dxyHist.shift();
  let dollarWeak = true;   // default allow when data missing, so we never silently block
  if (dxy != null && st.dxyHist.length >= 20) {
    const avg = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;
    dollarWeak = dxy < avg;
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
                       { label: 'USD weak (DXY < 20d avg)', ok: dollarWeak, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !dollarWeak) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
