/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion DOGE 4H
 * ex: binance
 * syms: DOGEUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce mean-reversion champion recipe
 * transferred to DOGE 4h to test whether the family's cross-asset edge extends
 * to a high-volatility meme asset. It buys rare panic bottoms above the 200-SMA
 * and is defensive: it protects capital in downtrends.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band /
 * RSI>50 or a 6-ATR stop; waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups (stays in cash and underperforms
 * buy-and-hold in a big bull); below the 200-SMA it never buys; a panic that
 * keeps falling still loses. Defensive, not a trend rider.
 * 2025-04-15: display-only watch declarations added — trading logic unchanged.
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
    const stopPx = atr != null ? ctx.entryPx - atr * 6 : null;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid-band exit', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] },
      { side: 'sell', price: stopPx != null ? stopPx : 0, trigger: 'below', note: '6-ATR stop' }
    ].filter(w => w.price > 0));
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
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'Price above SMA200', ok: price > sma200 }] }
  ]);

  if (price < bb.lower && rsi < 30) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
