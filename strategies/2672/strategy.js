/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion XLM 4H
 * ex: binance
 * syms: XLMUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Mean-reversion family. XLM 4h overreacts to the downside,
 * touches the lower Bollinger band, then snaps back to the mean. Buying the
 * panic-bottom and selling back to the middle captures the snap-back. This is
 * the exact validated champion recipe (unchanged, never tuned on XLM) being
 * tested on a fresh asset to extend the cross-asset evidence.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 above the 200-SMA; exits at the middle band / RSI>50 or a stop;
 * then waits 5 bars before the next entry.
 * When it does NOT work: lags strong melt-ups (sits in cash during rallies);
 * in a sustained downtrend below the 200-SMA it never buys; a panic that keeps
 * falling still loses. Mean reversion is defensive, not a trend rider.
 *
 * 2025-01-15: display-only change — added ctx.watch declarations, trading logic unchanged.
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
    const exitConds = [];
    const exitWatches = [];
    if (atr != null) {
      const stopPx = ctx.entryPx - atr * 6;
      exitWatches.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
      exitConds.push({ label: 'ATR(14) close', now: atr, op: '>=', ref: atr, closed: true });
    }
    exitWatches.push({ side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band target' });
    exitConds.push({ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true });
    ctx.watch(exitWatches);
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
  if (ctx.i - lastExit < 5) return null;

  if (price < sma200) return null;

  if (price < bb.lower && rsi < 30) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 close', now: sma200, op: '<', ref: price, closed: true }
    ]}]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
    { label: 'SMA200 close', now: sma200, op: '<', ref: price, closed: true }
  ]}]);
  return null;
}
