/*
 * @coinsori-strategy v1
 * name: BTC Trend Dip 1H VIX Guard
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (fast EMA above slow EMA) short dips tend to get
 * bought back up; a VIX risk-off guard keeps the strategy out of panic sell-offs.
 * When it buys and sells: buys a dip (RSI low) only while the 1h trend is up and VIX is calm;
 * sells when price breaks below a trailing level under the fast EMA, RSI gets overbought, or VIX spikes.
 * When it does NOT work: sideways chop whipsaws the trend filter into many small losses; a VIX
 * spike with no follow-through exits early and can miss the rebound.
 */

function onUpdate(ctx) {
  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (emaFast == null || emaSlow == null || rsi == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  // VIX regime z-score from stored daily history (base_vix has 2d lag, so no lookahead).
  const vix = ctx.data("base_vix");
  let st = ctx.state || {};
  let vixHist = st.vixHist || [];
  if (vix != null) {
    const last = vixHist.length ? vixHist[vixHist.length - 1] : null;
    if (last == null || Math.abs(last - vix) > 1e-9) vixHist.push(vix);
    if (vixHist.length > 250) vixHist = vixHist.slice(-250);
  }
  st.vixHist = vixHist;

  let vixZ = null;
  if (vixHist.length >= 60) {
    const n = vixHist.length;
    const mean = vixHist.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(vixHist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    if (sd > 1e-9) vixZ = (vix - mean) / sd;
  }
  // Missing VIX = neutral (do not block); with history use z<1.5 = calm, z>2 = panic.
  const riskOn = vix == null ? true : (vixZ == null ? vix < 30 : vixZ < 1.5);

  const uptrend = emaFast > emaSlow;
  const cooldown = st.lastExitBar != null && ctx.i - st.lastExitBar < 12; // 12h pause after an exit to avoid instant re-entry in chop

  const orders = [];
  const watch = [];

  if (pos <= 0) {
    if (uptrend && riskOn && !cooldown) {
      if (rsi < 40) {
        orders.push({ side: 'buy', qty: ctx.cash / price * 0.98 });
      }
      watch.push({ side: 'buy', price: emaFast, trigger: 'below', note: 'dip to EMA50 in uptrend', conds: [
        { label: 'EMA50>EMA200', ok: uptrend },
        { label: 'RSI14', now: rsi, op: '<', ref: 40, closed: true }
      ]});
    }
  } else {
    const stopPx = entry - 2.5 * atr;          // hard stop ~2.5 ATR below entry
    const trailPx = emaFast - 1.5 * atr;        // trailing exit under the fast EMA
    const exitTrail = price < trailPx;
    const exitOver = rsi > 72;
    const exitPanic = vixZ != null && vixZ > 2.0;
    if (exitTrail || exitOver || exitPanic) {
      orders.push({ side: 'sell', qty: pos, reduceOnly: true });
      st.lastExitBar = ctx.i;
    }
    watch.push({ side: 'sell', price: trailPx, trigger: 'below', note: 'trail below EMA50' });
    watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
    if (exitOver) watch.push({ side: 'sell', price: price, trigger: 'above', note: 'RSI overbought' });
  }

  ctx.state = st;
  ctx.watch(watch);
  return orders.length ? orders : null;
}
