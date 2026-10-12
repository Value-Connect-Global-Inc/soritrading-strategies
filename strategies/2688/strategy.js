/*
 * @coinsori-strategy v1
 * name: Band-Bounce + Trend-Pullback LINK 4H
 * ex: binance
 * syms: LINKUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce champion is defensive but lags
 * strong bull runs because it only buys panic dips below the lower band. This
 * version adds a second, more frequent "trend-pullback" entry so it can ride
 * pullbacks inside an uptrend instead of sitting in cash during melt-ups.
 * When it buys and sells: (1) panic-dip entry — price below lower BB(20,2) with
 * RSI<30 above the 200-SMA; (2) trend-pullback entry — price dips back to the
 * middle band while above the 200-SMA with RSI in a healthy 40-60 pullback zone.
 * Exits: middle band / RSI>50, or a 6-ATR stop; waits 5 bars before re-entering.
 * When it does NOT work: below the 200-SMA it never buys; a panic that keeps
 * falling still loses. The extra entries add trades in chop, so it can now lose
 * more in sideways markets than the pure defensive version.
 * 
 * 2024-01-15: Added ctx.watch declarations — display only, trading logic unchanged.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || rsi == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      ctx.watch([
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band exit' },
        { side: 'sell', price: ctx.entryPx - atr * 6, trigger: 'below', note: '6-ATR stop' }
      ]);
    } else {
      ctx.watch([
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band exit' }
      ]);
    }
    if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([{ side: 'buy', at: ctx.candle.time + (5 - (ctx.i - lastExit)) * 4 * 3600, note: 'cooldown' }]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([]);
    return null;
  }

  // Entry 1: panic dip below the lower band (the original defensive entry).
  if (price < bb.lower && rsi < 30) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'panic dip entry', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 close', ok: price > sma200 }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  // Entry 2: trend pullback to the middle band in an uptrend.
  // RSI 40-60 = a healthy pullback, not a panic and not overbought.
  // This is the new entry that captures melt-up pullbacks.
  if (price <= bb.mid * 1.01 && rsi >= 40 && rsi <= 60) {
    ctx.watch([{ side: 'buy', price: bb.mid * 1.01, trigger: 'below', note: 'trend pullback entry', conds: [{ label: 'RSI(14) close', now: rsi, op: '>=', ref: 40, closed: true }, { label: 'RSI(14) close', now: rsi, op: '<=', ref: 60, closed: true }, { label: 'SMA200 close', ok: price > sma200 }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'panic dip entry', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 close', ok: price > sma200 }] },
    { side: 'buy', price: bb.mid * 1.01, trigger: 'below', note: 'trend pullback entry', conds: [{ label: 'RSI(14) close', now: rsi, op: '>=', ref: 40, closed: true }, { label: 'RSI(14) close', now: rsi, op: '<=', ref: 60, closed: true }, { label: 'SMA200 close', ok: price > sma200 }] }
  ]);
  return null;
}
