/*
 * @coinsori-strategy v1
 * name: Dollar-Regime BTC Trend (risk 3%)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that historically rallies when the
 * US dollar weakens and falls when the dollar strengthens. Adding a dollar
 * regime check to a proven price-trend rule should filter out rallies that
 * happen against a strengthening dollar (often macro-driven selloffs).
 * When it buys and sells: buys when the previous close is above the 50-day EMA
 * AND the hash rate is above its 30-day average AND the dollar index is below
 * its own 50-day average (weak dollar = risk-on). Sells on a close below the
 * 50-day EMA or a 2.5x ATR hard stop. Positions risk 3% of cash per trade.
 * When it does NOT work: in a strong bull run with a strengthening dollar it
 * stays in cash and misses the move; the dollar filter also removes trades in
 * flat markets. Trend-following means it loses in chop, and it is more
 * conservative than the plain trend strategy so it may underperform in quiet
 * uptrends.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

  // ---- dollar regime (carried forward on non-business days) ----
  const st = ctx.state || {};
  let hist = Array.isArray(st.dxyHist) ? st.dxyHist.slice() : [];
  let lastDxy = Number.isFinite(st.lastDxy) ? st.lastDxy : null;
  const dxyRaw = ctx.data('dxy');
  const dxy = dxyRaw == null || !Number.isFinite(Number(dxyRaw)) ? lastDxy : Number(dxyRaw);
  let dxySma = null;
  if (dxy != null) {
    hist.push(dxy);
    if (hist.length > 60) hist = hist.slice(-60);
    if (hist.length >= 50) {
      let sum = 0;
      for (let i = hist.length - 50; i < hist.length; i++) sum += hist[i];
      dxySma = sum / 50;
    }
    ctx.state = { dxyHist: hist, lastDxy: dxy };
  }
  const dollarWeak = dxySma != null && dxy != null && dxy < dxySma;

  // ---- network health ----
  const hrVal = Number(ctx.data('hashrate'));
  const hrAvg = Number(ctx.data('hashrate_sma30'));
  const networkHealthy = Number.isFinite(hrVal) && Number.isFinite(hrAvg) && hrAvg > 0 && hrVal > hrAvg;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend, closed: true },
                       { label: 'hashrate > 30d avg', ok: networkHealthy, closed: true },
                       { label: 'dxy < 50d avg', ok: dollarWeak, closed: true }] }]);
  if (!uptrend || !networkHealthy || !dollarWeak) return null;

  const riskCash = ctx.cash * 0.03;         // risk 3% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
