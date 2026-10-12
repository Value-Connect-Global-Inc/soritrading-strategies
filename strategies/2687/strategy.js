/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion AVAX 4H
 * ex: binance
 * syms: AVAXUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated champion recipe applied to AVAX 4h, a mature
 * large-cap. Tests whether the defensive mean-reversion edge extends to AVAX.
 * Unchanged recipe.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band / RSI>50
 * or a 6-ATR stop; then waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups; below the 200-SMA it never buys;
 * a panic that keeps falling still loses. Defensive, not a trend rider.
 *
 * 2025-01-15: display-only changes (ctx.watch added), trading logic unchanged.
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
    const stopPx = ctx.entryPx - (atr != null ? atr * 6 : 0);
    const exitMid = price >= bb.mid || rsi > 50;
    const exitStop = atr != null && price <= stopPx;
    if (exitMid || exitStop) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'middle band exit', conds: [
        { label: 'RSI(14) closed', now: rsi, op: '>', ref: 50, closed: true }
      ]},
      { side: 'sell', price: stopPx, trigger: 'below', note: '6-ATR stop' }
    ]);
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  if (ctx.i - lastExit < 5) {
    ctx.watch([{ side: 'buy', at: ctx.i + (5 - (ctx.i - lastExit)), note: 'cooldown end' }]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200' }]);
    return null;
  }

  if (price < bb.lower && rsi < 30) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) closed', now: rsi, op: '<', ref: 30, closed: true }
    ]}
  ]);
  return null;
}
