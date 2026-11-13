/*
 * @coinsori-strategy v1
 * name: ETH 4H Trend Pullback ATR Stop
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 1000
 *
 * ETH trends strongly on 4h. We buy pullbacks (price dips below the 20-EMA)
 * only while the 50-EMA is above the 200-EMA, and we trail an ATR stop so
 * profits are locked and the worst chop is cut. Long-only spot so we can
 * compare honestly with buying and holding.
 * It does NOT work in a sideways/choppy market where pullbacks keep failing
 * and stops are hit repeatedly, and it misses sharp V-shaped reversals.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || ema20 == null || rsi == null || atr == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = ema50 > ema200;
  const entryWatch = [
    { side: 'buy', price: ema20, trigger: 'below', note: 'pullback below EMA20', conds: [
      { label: 'EMA50>EMA200', ok: uptrend },
      { label: 'RSI(14)', now: rsi, op: '>', ref: 40, closed: true },
      { label: 'RSI(14)', now: rsi, op: '<', ref: 65, closed: true }
    ]}
  ];

  // Exit: ATR trailing stop, ratcheted up each bar while holding.
  if (ctx.position > 0) {
    let trail = ctx.state.trail;
    if (trail == null || trail <= 0) {
      trail = (ctx.entryPx != null ? ctx.entryPx : prevClose) - 3 * atr;
    }
    const candidate = prevClose - 3 * atr;
    trail = Math.max(trail, candidate);
    ctx.state.trail = trail;
    ctx.watch([
      { side: 'sell', price: trail, trigger: 'below', note: 'ATR trailing stop' },
      entryWatch[0]
    ]);
    if (prevClose < trail) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // Entry: closed below the 20-EMA (pullback) inside an uptrend.
  if (uptrend && prevClose < ema20 && rsi > 40 && rsi < 65) {
    const riskPerCoin = 3 * atr;
    const riskBudget = ctx.cash * 0.02;
    let qty = riskBudget / riskPerCoin;
    const maxQty = (ctx.cash / prevClose) * 0.99;
    qty = Math.min(qty, maxQty);
    ctx.state.trail = null;
    ctx.watch(entryWatch);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch(entryWatch);
  return null;
}
