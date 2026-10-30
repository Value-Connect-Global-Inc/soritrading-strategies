/*
 * @coinsori-strategy v1
 * name: ETH Fear&Greed Contrarian 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: the Fear & Greed index is a daily sentiment gauge (0=extreme fear, 100=extreme
 * greed). In crypto, extreme fear marks capitulation bottoms and extreme greed marks
 * euphoric tops — a behavioural pattern price alone cannot see. We buy fear, sell greed.
 * When it buys and sells: when the index is in extreme fear (< 25) and we are flat, we
 * go long, sizing up the deeper the fear. We sell when the index reaches greed (> 70),
 * or on a 25% trailing stop from the peak, or a 25% hard stop below entry.
 * When it does NOT work: in a slow grinding bear market the index can stay in extreme
 * fear for months — each new fear reading buys into a falling knife until the hard stop
 * cuts it. The edge is real only when fear marks a genuine reversal, not a long descent.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  if (fg == null) return null;
  const price = ctx.price, pos = ctx.position;

  if (pos > 0) {
    let peak = ctx.state.peak;
    if (peak == null || price > peak) peak = price;
    ctx.state.peak = peak;
    const trail = peak * 0.75; // 25% trailing stop from peak
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.75 : null; // 25% hard stop
    ctx.watch([
      { side: 'sell', price: null, trigger: 'above', note: 'F&G > 70 greed', conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 70, closed: true }] },
      { side: 'sell', price: trail, trigger: 'below', note: '25% trailing stop' },
      { side: 'sell', price: stop, trigger: 'below', note: '25% hard stop' }
    ]);
    if (fg > 70) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= trail) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  ctx.state.peak = null;
  ctx.watch([{ side: 'buy', price: null, trigger: 'below', note: 'F&G < 25 fear', conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25, closed: true }] }]);
  if (fg < 25) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.6 };
    // deeper fear = more conviction: size 50% at fg=25 up to 90% at fg=0
    const frac = 0.5 + ((25 - fg) / 25) * 0.4;
    const risk = Math.min((ctx.cash / price) * frac, (ctx.cash * 0.02) / atr * 5);
    const qty = Math.max(risk, (ctx.cash / price) * 0.25); // floor at 25% of cash
    return { side: 'buy', qty: qty };
  }
  return null;
}
