/*
 * @coinsori-strategy v1
 * name: BTC Trend Long-Short Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A slow trend filter on BTC perpetuals is traded in BOTH directions. Long-only
 * strategies miss the short-side profit in bear markets, which is why they rarely beat holding in
 * mixed windows. Going short in downtrends adds a second source of return and cuts drawdown.
 * When it buys and sells: Long when the 50-EMA is above the 200-EMA and price is above it; short
 * when the 50-EMA is below the 200-EMA and price is below it. Exit and reverse on the opposite
 * signal. Position is sized by RISK: the hard stop is 2.5x ATR away and each trade risks 5% of equity.
 * When it does NOT work: In a flat sideways chop the EMA pair crosses often and each crossing pays fees.
 * Shorts pay funding in bull markets. A violent reversal inside one 4h candle can gap through the stop.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1);
  const emaS = ctx.ema(200, 1);
  if (emaF == null || emaS == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position || 0;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // Fresh start (no state yet): may be deployed holding a restored position.
  if (ctx.state.lastPos === undefined) {
    ctx.state.lastPos = pos;
    ctx.state.closing = false;
    ctx.state.flatWait = 0;
    ctx.watch([]);
    return null;
  }

  // We just became flat (normal close landed, or restart reset the position).
  // Enforce a re-entry cooldown so we never open an opposite position on a stale
  // view that can persist ~9 bars after a restart.
  if (pos === 0 && (ctx.state.lastPos !== 0 || ctx.state.closing)) {
    ctx.state.closing = false;
    ctx.state.flatWait = (ctx.state.flatWait || 0) + 1;
    if (ctx.state.flatWait < 24) {
      ctx.watch([]);
      return null;
    }
    ctx.state.lastPos = 0;
    ctx.state.flatWait = 0;
  }
  ctx.state.lastPos = pos;

  const equity = ctx.cash + pos * ctx.price;
  const alloc = ctx.alloc;
  const forced = alloc != null && alloc.lastForced != null;

  // The platform force-closed for us (L5): never add our own close on top of it.
  if (forced && pos !== 0) {
    ctx.watch([]);
    return null;
  }

  // risk-based sizing: 2.5x ATR stop, each trade risks 5% of equity (0.05/2.5 = 0.02 per ATR)
  const stopDist = 2.5 * atr;
  const riskFrac = 0.05;
  const targetQty = (equity * riskFrac) / stopDist;

  // hard stop at 2.5x ATR
  if (pos !== 0 && ctx.entryPx != null) {
    if (pos > 0 && prevClose < ctx.entryPx - stopDist) {
      ctx.state.closing = true;
      ctx.watch([{ side: 'sell', price: ctx.entryPx - stopDist, trigger: 'below', note: 'long hard stop' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (pos < 0 && prevClose > ctx.entryPx + stopDist) {
      ctx.state.closing = true;
      ctx.watch([{ side: 'buy', price: ctx.entryPx + stopDist, trigger: 'above', note: 'short hard stop' }]);
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
  }

  const longSig = emaF > emaS && prevClose > emaS;
  const shortSig = emaF < emaS && prevClose < emaS;
  const band = 0.005; // 0.5% hysteresis so tiny EMA noise does not churn

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: emaS, trigger: 'below', note: 'EMA200 flip exit', conds: [{ label: 'EMA50<EMA200', ok: shortSig }] },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'long exit' }
    ]);
    if (shortSig || prevClose < emaS * (1 - band)) {
      ctx.state.closing = true;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    ctx.watch([
      { side: 'buy', price: emaS, trigger: 'above', note: 'EMA200 flip exit', conds: [{ label: 'EMA50>EMA200', ok: longSig }] },
      { side: 'buy', price: prevClose, trigger: 'above', note: 'short exit' }
    ]);
    if (longSig || prevClose > emaS * (1 + band)) {
      ctx.state.closing = true;
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // Platform allocation is not ready or is in reduce-only mode: no new entries.
  if (alloc != null && alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }

  if (longSig) {
    ctx.watch([{ side: 'buy', price: emaS, trigger: 'above', note: 'go long', conds: [{ label: 'EMA50>EMA200', ok: true }] }]);
    return { side: 'buy', qty: targetQty };
  }
  if (shortSig) {
    ctx.watch([{ side: 'sell', price: emaS, trigger: 'below', note: 'go short', conds: [{ label: 'EMA50<EMA200', ok: true }] }]);
    return { side: 'sell', qty: targetQty };
  }
  ctx.watch([]);
  return null;
}
