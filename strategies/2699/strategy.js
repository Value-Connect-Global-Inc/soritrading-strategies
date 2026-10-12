/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion SOL 4H
 * ex: binance
 * syms: SOLUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce mean-reversion champion recipe
 * on SOL 4h — the family's strongest demonstration. It buys rare panic bottoms
 * above the 200-SMA and is a defensive mean-reversion: it protects capital in
 * downtrends and made money even in a bull window where it beat buy-and-hold.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band /
 * RSI>50 or a 6-ATR stop; waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups (stays in cash and underperforms
 * buy-and-hold in a big bull); below the 200-SMA it never buys; a panic that
 * keeps falling still loses. Defensive, not a trend rider.
 *
 * 2025-01-19: display-only change (ctx.watch added), trade logic unchanged.
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
    const exitMid = bb.mid;
    const exitRsi = 50;
    const exitStop = atr != null ? ctx.entryPx - atr * 6 : null;
    const conds = [
      { label: 'RSI(14) close', now: rsi, op: '>', ref: exitRsi, closed: true }
    ];
    if (atr != null) {
      conds.push({ label: 'ATR(14) close', now: atr, op: '>', ref: 0, closed: true });
    }
    ctx.watch([
      { side: 'sell', price: exitMid, trigger: 'above', note: 'exit at mid BB', conds: conds.slice(0, 1) },
      { side: 'sell', price: exitStop, trigger: 'below', note: '6-ATR stop', conds: conds.slice(1) }
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
    ctx.watch([{ side: 'buy', at: ctx.i + (5 - (ctx.i - lastExit)), note: 'cooldown remaining' }]);
    return null;
  }

  if (price < sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200' }]);
    return null;
  }

  if (price < bb.lower && rsi < 30) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Price above SMA200', ok: price > sma200 }
    ]}]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
    { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
    { label: 'Price above SMA200', ok: price > sma200 }
  ]}]);
  return null;
}
