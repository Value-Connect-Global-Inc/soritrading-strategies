/*
 * @coinsori-strategy v1
 * name: Band-Bounce Bull-Ride Exit SOL 4H
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce champion is defensive but its
 * known weakness is missing bull melt-ups (SOL W1 +145% vs hold +2922%).
 * This variant keeps the champion's exact panic-bottom entry but improves the
 * EXIT: in a confirmed uptrend it holds winners with a wide trailing stop
 * instead of exiting at the middle band, so it can ride a strong bull.
 * No new entries, so it avoids the whipsaw that killed the trend-participation leg.
 * When it buys and sells: same buy as the champion (lower Bollinger + RSI<30
 * above the 200-SMA). Exit: if in a strong uptrend (20-EMA above 50-EMA above
 * 200-SMA) hold with a 12-ATR trailing stop; otherwise exit at mid-band / RSI>50.
 * When it does NOT work: below the 200-SMA it never buys; a panic that keeps
 * falling still loses; a choppy bull can give back gains before the wide trail
 * triggers. Defensive core, slightly more upside participation.
 *
 * 2026-01-20: display-only ctx.watch added — trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  if (bb == null || rsi == null || sma200 == null || ema20 == null || ema50 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;
  const atr = ctx.atr(14, 1);

  if (pos > 0) {
    const strongTrend = price > sma200 && ema20 > ema50;
    if (strongTrend && atr != null) {
      // Wide 12-ATR trail lets a big melt-up run without giving back early.
      const trail = ctx.state.trail || (ctx.entryPx - atr * 12);
      const newTrail = Math.max(trail, price - atr * 12);
      ctx.state.trail = newTrail;
      ctx.watch([
        { side: 'sell', price: newTrail, trigger: 'below', note: '12-ATR trail' },
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid-band exit' },
        { side: 'sell', price: ctx.entryPx - atr * 6, trigger: 'below', note: '6-ATR stop' }
      ]);
      if (price <= newTrail) {
        ctx.state.lastExit = ctx.i;
        ctx.state.trail = null;
        return { side: 'sell', qty: pos };
      }
      return null;
    }
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid-band exit' },
      { side: 'sell', price: ctx.entryPx - (atr != null ? atr * 6 : 0), trigger: 'below', note: '6-ATR stop' }
    ]);
    if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      ctx.state.trail = null;
      return { side: 'sell', qty: pos };
    }
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      ctx.state.trail = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [ { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true } ] }
  ]);
  if (price < bb.lower && rsi < 30) {
    ctx.state.trail = null;
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
