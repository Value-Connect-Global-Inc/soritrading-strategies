/*
 * @coinsori-strategy v1
 * name: Squeeze Breakout SOL 4H v2
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Volatility contraction builds energy for a breakout. This
 * version uses RELATIVE compression (current band width well below its own recent
 * average) instead of an absolute running-min, so it fires more often than v1.
 * SOL is the asset where the momentum/breakout family genuinely worked.
 * When it buys and sells: buys when the 20-2 Bollinger width is compressed to
 * ~65% of its recent average AND price closes above the upper band on
 * above-average volume. Exits on close below the middle band, RSI>65, or 6-ATR.
 * When it does NOT work: in persistent downtrends the squeeze resolves downward
 * and the upper-band entry fires into a falling market; dead chop triggers and
 * reverses. Needs genuine post-squeeze expansion.
 *
 * 2024-01-01 — display only changed, trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;
  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const rsi = ctx.rsi(14, 1);
    if (rsi != null && (price < bb.mid || rsi > 65)) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    const atr = ctx.atr(14, 1);
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    // Watch exits: middle band, RSI>65, 6-ATR stop
    const watchExits = [
      { side: 'sell', price: bb.mid, trigger: 'below', note: 'close below mid band' }
    ];
    if (rsi != null) {
      watchExits.push({ side: 'sell', price: rsi, trigger: 'above', note: 'RSI>65', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 65, closed: true }] });
    }
    if (atr != null) {
      watchExits.push({ side: 'sell', price: ctx.entryPx - atr * 6, trigger: 'below', note: '6-ATR stop' });
    }
    ctx.watch(watchExits);
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([{ side: 'buy', at: lastExit + 5, note: 'cooldown after exit' }]);
    return null;
  }

  // Relative compression: track a rolling EMA of band width in state. Buy when
  // current width drops below 65% of that average (a genuine squeeze) — fires
  // far more often than v1's absolute running-min.
  const width = (bb.upper - bb.lower) / bb.mid;
  let wAvg = ctx.state.wAvg;
  if (wAvg == null) wAvg = width;
  else wAvg = wAvg * 0.95 + width * 0.05;
  ctx.state.wAvg = wAvg;
  if (wAvg <= 0) return null;

  const vol = ctx.vol;
  const avgVol = ctx.avgVol(20);
  if (vol == null || avgVol == null) return null;
  if (vol < avgVol * 1.2) {
    // Watch entry price but volume not confirmed
    ctx.watch([{ side: 'buy', price: bb.upper, trigger: 'above', note: 'BB upper break', conds: [{ label: 'width compress', now: width, op: '<=', ref: wAvg * 0.65, closed: true }, { label: 'volume', now: vol, op: '>=', ref: avgVol * 1.2 }] }]);
    return null;
  }

  if (width <= wAvg * 0.65 && price > bb.upper) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  // Watch entry: need both squeeze and break
  ctx.watch([{ side: 'buy', price: bb.upper, trigger: 'above', note: 'BB upper break', conds: [{ label: 'width compress', now: width, op: '<=', ref: wAvg * 0.65, closed: true }, { label: 'volume', now: vol, op: '>=', ref: avgVol * 1.2 }] }]);
  return null;
}
