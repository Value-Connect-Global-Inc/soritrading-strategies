/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: Bitcoin trends up when market fear (CBOE VIX) is calm and falls when fear spikes. A daily trend filter plus a fear gauge keeps the position on during calm uptrends and steps aside when fear jumps.
 * When it buys and sells: buys when price is above the 50-day average and VIX is calm; sells when price drops below the 50-day average, when VIX jumps to an extreme, or when price falls 25% below the entry.
 * When it does NOT work: in choppy sideways markets the trend filter whipsaws; VIX is published with a 2-day delay, so a sudden crash is only detected after it has started.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;

  const emaT = ctx.ema(50, 1);
  if (emaT == null) { ctx.watch([]); return null; }

  const vix = ctx.data('base_vix');
  if (vix == null) { ctx.watch([]); return null; }

  let hist = (ctx.state.vixHist || []).slice();
  hist.push(vix);
  if (hist.length > 300) hist = hist.slice(-300);
  ctx.state.vixHist = hist;

  let vixZ = 0;
  if (hist.length >= 30) {
    const n = hist.length;
    let s = 0;
    for (let i = 0; i < n; i++) s += hist[i];
    const m = s / n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (hist[i] - m) * (hist[i] - m);
    const sd = Math.sqrt(v / n);
    if (sd > 0.5) vixZ = (vix - m) / sd;
  }

  const calm = vixZ < 1.0 && vix < 25;
  const fearful = vixZ > 1.5 || vix > 30;

  const lastExit = ctx.state.lastExitBar != null ? ctx.state.lastExitBar : -999;
  const cooled = ctx.i - lastExit >= 10; // 10 days cooldown after any exit

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: emaT, trigger: 'above', note: 'uptrend + calm VIX', conds: [{ label: 'VIX', now: vix, op: '<', ref: 25 }, { label: 'cooldown', ok: cooled }] }]);
    if (px > emaT && calm && cooled) {
      return { side: 'buy', qty: (cash / px) * 0.98 };
    }
    return null;
  }

  // Wide 25% disaster stop: only real blowups hit it, normal daily noise does not
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
  const exitTrend = px < emaT;
  const exitStop = stopPx != null && px < stopPx;

  const w = [{ side: 'sell', price: emaT, trigger: 'below', note: 'trend exit' }];
  if (stopPx != null) w.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'disaster stop' });
  w.push({ side: 'sell', price: emaT, trigger: 'below', note: 'fear exit', conds: [{ label: 'VIX', now: vix, op: '>', ref: 30 }] });
  ctx.watch(w);

  if (exitTrend || fearful || exitStop) {
    ctx.state.lastExitBar = ctx.i;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
