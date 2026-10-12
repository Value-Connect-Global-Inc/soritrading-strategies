/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion APT 4H
 * ex: binance
 * syms: APTUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The band-bounce mean-reversion champion recipe, validated
 * unchanged across 17+ crypto large-caps on 4h. APT is a top-20 large-cap that
 * has not yet been run through the recipe — a fresh confirmation of the family's
 * cross-asset robustness.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band / RSI>50
 * or a 6-ATR stop; waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups; below the 200-SMA it never buys;
 * a panic that keeps falling still loses. Defensive, not a trend rider.
 *
 * 2024-01-15: Only display declarations (ctx.watch) added — trading logic unchanged.
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
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid band exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] },
      { side: 'sell', price: ctx.entryPx - (atr != null ? atr * 6 : 0), trigger: 'below', note: '6-ATR stop' }
    ]);
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
    ctx.watch([]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] }
  ]);

  if (price < bb.lower && rsi < 30) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
