/*
 * @coinsori-strategy v1
 * name: BTC 4h Panic Fade Mean-Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: sharp BTC selloffs are usually overdone — the price falls far below its
 * own recent average and then mean-reverts back toward it. This is the opposite bet to trend
 * following: we buy the panic, not the breakout.
 * When it buys: the price is more than 2 standard deviations below its 100-bar mean AND
 * RSI(14) is below 25 (deep oversold) — a capitulation dip.
 * When it sells: the price returns to its 100-bar mean, RSI recovers above 50, or a -8% hard
 * stop is hit (fading is risky, so the stop is tight).
 * When it does NOT work: in a true bear market the "panic" keeps going lower and the -8% stop
 * is hit repeatedly (whipsaw losses); in a quiet low-volatility market the signal almost
 * never fires so it sits in cash.
 */
function onUpdate(ctx) {
  const z = ctx.zscore(100, 1);
  const r = ctx.rsi(14, 1);
  const mean = ctx.sma(100, 1);
  if (z == null || r == null || mean == null) return null;
  const price = ctx.price;
  const inPos = ctx.position > 0;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.92 : 0;

  const panic = z < -2 && r < 25;
  const recovered = price >= mean || r > 50;

  ctx.watch([
    ...(inPos ? [
      { side:'sell', price: mean, trigger:'above', note:'return to mean', conds:[
        { label:'RSI(14) close', now: r, op:'>', ref:50, closed:true }
      ]},
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [
      { side:'buy', price: mean, trigger:'below', note:'panic dip', conds:[
        { label:'z-score', now: z, op:'<', ref:-2, closed:true },
        { label:'RSI(14) close', now: r, op:'<', ref:25, closed:true }
      ]}
    ])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
    if (recovered) return { side:'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (panic) {
    return { side:'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
