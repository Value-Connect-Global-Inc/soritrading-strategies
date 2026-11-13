/*
 * @coinsori-strategy v1
 * name: VolConfirmed Pullback 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A breakout on high volume marks the start of a new trend,
 * but the best entry is the normal pullback after it, not the breakout pop.
 * When it buys and sells: it buys when price pulls back to the 20-bar average
 * within a few bars of a high-volume 20-bar breakout while the 200-bar trend is
 * up. It holds with a wide stop until price makes a new high above the breakout
 * (proving the trend resumed), then trails tightly; it exits on the trail or if
 * it never resumes.
 * When it does NOT work: in a sideways market the "breakouts" are fake, every
 * pullback keeps falling and the stops bleed the account; it also lags holding
 * in a smooth straight-up bull market.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  function donHigh(ago, n) {
    let h = -Infinity;
    for (let k = ago + 1; k <= ago + n; k++) h = Math.max(h, ctx.highs.at(-k));
    return h;
  }

  // --- Position management first (never blocked by warm-up) ---
  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    // Record the breakout high we entered on; once price exceeds it, trend resumed.
    const resumeLevel = ctx.state.resume != null ? ctx.state.resume : Infinity;
    const resumed = price > resumeLevel;
    if (resumed) ctx.state.resumed = true;
    if (price > (ctx.state.highest || 0)) ctx.state.highest = price;

    let exitPx;
    if (ctx.state.resumed) {
      // After resumption: trailing chandelier 1.8 ATR below the high.
      const chand = atrNow != null ? (ctx.state.highest || price) - 1.8 * atrNow : (ctx.state.highest || price) * 0.96;
      const hard = ctx.state.stop != null ? ctx.state.stop : price * 0.8;
      exitPx = Math.min(chand, hard);
    } else {
      // Before resumption: wide stop only, give the pullback room to work.
      exitPx = ctx.state.stop != null ? ctx.state.stop : (atrNow != null ? price - 3.5 * atrNow : price * 0.82);
    }
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'Trail/stop exit' }]);
    if (exitPx > 0 && price <= exitPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // --- Warm-up ---
  if (ctx.closes.length < 220 || ctx.highs.length < 22 || ctx.volumes.length < 22) {
    ctx.watch([]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  // Regime filter: only take longs above the 200-bar average (stay out of bear markets).
  const uptrend = prevClose > sma200;

  // Volume confirmation from CLOSED bars only (stable in live, not the forming bar).
  const vols = ctx.volumes;
  let vsum = 0;
  for (let k = 2; k <= 21; k++) vsum += vols.at(-k);
  const avgVol = vsum / 20;
  // 1.1x average: lenient so enough breakouts qualify for a tradable frequency.
  const volConfirmed = vols.at(-2) > avgVol * 1.1;

  // Confirmed breakout: last closed bar above the prior 20-bar high WITH volume.
  const level20 = donHigh(2, 20);
  const confirmedBreakout = prevClose > level20 && volConfirmed;
  if (confirmedBreakout) ctx.state.breakoutI = ctx.i - 1;

  const ema20 = ctx.ema(20, 1);
  const atrNow = ctx.atr(14, 1);
  const recentBreakout = ctx.state.breakoutI != null && (ctx.i - ctx.state.breakoutI) <= 10;
  // Pullback zone: within 1 ATR below the 20-EMA (a normal retrace, not a crash).
  const pulledBack = ema20 != null && price <= ema20 * 1.005 && price >= ema20 - (atrNow != null ? atrNow : ema20 * 0.02);
  // Cooldown: at least 8 bars between entries so we do not re-enter the same dip.
  const cooldownOk = ctx.state.lastEntryI == null || (ctx.i - ctx.state.lastEntryI) >= 8;

  ctx.watch([{
    side: 'buy', price: ema20, trigger: 'below', note: 'Pullback to EMA20',
    conds: [
      { label: 'High-volume breakout <=10 bars ago', ok: recentBreakout },
      { label: 'Above SMA200', ok: uptrend }
    ]
  }]);
  if (uptrend && recentBreakout && pulledBack && cooldownOk) {
    // Wide stop before resumption: 3.5 ATR below entry (give the pullback room).
    ctx.state.stop = atrNow != null ? price - 3.5 * atrNow : price * 0.82;
    ctx.state.highest = price;
    ctx.state.resume = level20;
    ctx.state.resumed = false;
    ctx.state.lastEntryI = ctx.i;
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty };
  }
  return null;
}
