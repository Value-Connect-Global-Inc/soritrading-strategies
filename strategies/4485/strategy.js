/*
 * @coinsori-strategy v1
 * name: Dollar-Regime Gated Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset — it tends to rally when the US
 * dollar weakens and struggle when it strengthens. We only buy momentum when the
 * dollar is in a weak regime, skipping the phases where a strong dollar squeezes risk.
 * When it buys and sells: buys when 30-day return is positive, close is above the
 * 200-day EMA, and the dollar is below its own 60-day average. Sells when close
 * falls below the 200-day EMA, 30-day return turns negative, or a 15% hard stop.
 * When it does NOT work: the dollar is a slow macro signal — it lags a sudden
 * risk-off crash by weeks and is business-days-only, so weekend entries can slip
 * past the filter. It will not protect against a fast dollar spike.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
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

  // Dollar-regime gate: only buy when the dollar is below its own 60-day average
  // (weak-dollar = risk-on). Missing data defaults to allowing the trade.
  const dxy = ctx.data('dxy');
  const hist = ctx.state.dxyHist || [];
  let dollarWeak = true;
  if (dxy != null) {
    if (hist.length >= 60) {
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      dollarWeak = dxy < avg;
    }
    hist.push(dxy);
    if (hist.length > 60) hist.shift();
    ctx.state.dxyHist = hist;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'dollar < 60d avg', ok: dollarWeak, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !dollarWeak) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
