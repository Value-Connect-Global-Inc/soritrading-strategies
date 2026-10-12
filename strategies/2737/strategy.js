/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion SUI 4H
 * ex: binance
 * syms: SUIUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The band-bounce mean-reversion champion recipe, validated
 * unchanged across 20+ crypto large-caps on 4h. It buys rare panic bottoms and
 * is defensive: it protects capital in downtrends and has made money in most
 * walk-forward windows. SUI is a fresh stable mature large-cap ideal for this family.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band /
 * RSI>50 or a 6-ATR stop; waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups (stays in cash and underperforms
 * buy-and-hold in a big bull); below the 200-SMA it never buys; a panic that
 * keeps falling still loses. Defensive, not a trend rider.
 *
 * 2024-01-01: watch 선언만 추가됨 — 표시만 바뀜, 매매 판단은 그대로
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
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'middle band exit', conds: [{ label: 'RSI(14) > 50', now: rsi, op: '>', ref: 50, closed: true }] },
      { side: 'sell', price: stopPx, trigger: 'below', note: '6-ATR stop', conds: [{ label: 'ATR(14)', now: atr, op: '>', ref: 0, closed: true }] }
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
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Price above SMA200', now: price, op: '>', ref: sma200, closed: false }
    ]}
  ]);

  if (price < bb.lower && rsi < 30) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
