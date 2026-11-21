/*
 * @coinsori-strategy v1
 * name: BTC 4h Trend Ride + VIX Size Overlay
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven trend ride (EMA50>EMA200 entry, F&G<85 euphoria
 * filter, ATR de-risk, -20% hard stop) works, but macro volatility is a real risk
 * overlay: when equity vol (VIX) is elevated, crypto crashes are more likely. Instead
 * of gating entries on/off (which churned on 4h), this scales POSITION SIZE down when
 * VIX is high and back up when it calms — same trend logic, softer risk control.
 * When it buys: EMA50 above EMA200 (uptrend), Fear & Greed below 85, and the size is
 * full (100%), half (50%) or quarter (25%) depending on how elevated VIX is.
 * When it sells: trend flips down, -20% hard stop, or the ATR de-risk cut at high vol.
 * When it does NOT work: VIX is 2-day lagged, so a fast crypto crash that VIX has not
 * yet registered still hits the -20% stop at full size; and in a calm-VIX bear the
 * overlay never shrinks and the strategy bleeds like a plain trend rider.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6);
  if (e50Prev == null) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const vix = ctx.data('base_vix');
  if (vix == null) return null;

  // Rolling VIX history for a z-score vs its own mean (regime shape, not a fixed level).
  const hist = Array.isArray(ctx.state.vixHist) ? ctx.state.vixHist : [];
  hist.push(vix);
  if (hist.length > 200) hist.shift();
  ctx.state.vixHist = hist;
  let vz = null;
  if (hist.length >= 60) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
    if (sd > 0.01) vz = (vix - mean) / sd;
  }
  if (vz == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS;
  const falling = e50 < e50Prev;
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const equity = ctx.cash + ctx.position * price;

  // VIX size overlay: full size when calm, 50% at z>1, 25% at z>2 (macro risk-off taper).
  const vixMult = vz > 2 ? 0.25 : vz > 1 ? 0.5 : 1;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend, not euphoric', conds:[{label:'F&G', now: fg, op:'<', ref: 85, closed:true},{label:'VIX z', now: vz, op:'<', ref: 2, closed:true}] },
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!up) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!deRisked && shouldDeRisk) {
      ctx.state.deRisked = true;
      const diff = ctx.position - (equity / price) * 0.4;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      ctx.state.deRisked = false;
      const diff = (equity / price) * 0.99 - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
    return null;
  }
  if (up && fg < 85) {
    // Entry size = full trend size scaled by the VIX overlay (and the ATR de-risk state).
    const qty = (equity / price) * 0.99 * vixMult * (deRisked ? 0.4 : 1);
    return { side:'buy', qty: qty };
  }
  return null;
}
