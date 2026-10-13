let h = [];
let lastExitBar = -1e9;

function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const raw = ctx.data('hashrate');
  const hr = Number(raw);
  if (!isFinite(hr)) {
    ctx.log('hashrate null/NaN at bar', ctx.i, typeof raw, raw);
    return null;
  }
  h.push(hr);
  if (h.length > 300) h = h.slice(-300);

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null) return null;
  if (h.length < 61) return null;

  const closed = h.slice(0, -1);
  if (closed.length < 60) return null;
  const ma30 = closed.slice(-30).reduce((a, b) => a + b, 0) / 30;
  const ma60 = closed.slice(-60).reduce((a, b) => a + b, 0) / 60;

  ctx.log('bar', ctx.i, 'hr', hr, 'ma30', ma30, 'ma60', ma60, 'px', prevClose, 'sma200', sma200);

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2.5 * atr;
    if (ma30 < ma60 || prevClose < sma50 || prevClose < stop) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (ma30 > ma60 && prevClose > sma200 && (ctx.i - lastExitBar > 15)) {
    const stopDist = Math.max(2.5 * atr, prevClose * 0.03);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
