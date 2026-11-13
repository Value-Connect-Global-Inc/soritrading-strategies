/*
 * @coinsori-strategy v1
 * name: BTC Funding-Sign Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: funding rates show which way leveraged money is paying — positive funding
 * means longs pay shorts (bullish flow), negative means shorts pay longs (bearish flow). Instead
 * of fading the crowd (which lost heavily in trends), we trade WITH the flow: a trend signal is
 * only taken when the funding sign agrees with it.
 * When it buys and sells: buys on a closed-bar EMA20/EMA50 up-cross while funding is positive;
 * sells short on the mirror image. Positions are closed by a 2.5xATR trailing stop (winners run)
 * or a 5xATR disaster stop (hard cap on one bad call).
 * When it does NOT work: in chop where the EMAs cross often and funding hovers near zero — the
 * filter lets few trades through yet the trailing stop still gives back gains.
 */

function onUpdate(ctx) {
  const funding = ctx.funding;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const emaF1 = ctx.ema(20, 1);
  const emaF2 = ctx.ema(20, 2);
  const emaS = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);

  if (emaF1 == null || emaF2 == null || emaS == null || atr1 == null || funding == null) return null;
  if (pos !== 0 && entry == null) return null;

  const trailMult = 2.5; // trailing stop in ATR — lets winners run
  const stopMult = 5.0;  // disaster stop in ATR — hard cap on a single bad call

  let ref = ctx.state.ref != null ? ctx.state.ref : entry;
  const longTrail = ref - trailMult * atr1;
  const shortTrail = ref + trailMult * atr1;
  const longStop = entry - stopMult * atr1;
  const shortStop = entry + stopMult * atr1;

  ctx.watch([
    { side: 'buy', price: emaS, trigger: 'above', note: 'EMA20 upcross + funding>0', conds: [{ label: 'funding', now: funding, op: '>', ref: 0, closed: true }] },
    { side: 'sell', price: emaS, trigger: 'below', note: 'EMA20 downcross + funding<0', conds: [{ label: 'funding', now: funding, op: '<', ref: 0, closed: true }] },
    ...(pos > 0 ? [
      { side: 'sell', price: longTrail, trigger: 'below', note: '2.5 ATR trail' },
      { side: 'sell', price: longStop, trigger: 'below', note: '5 ATR disaster stop' }
    ] : []),
    ...(pos < 0 ? [
      { side: 'buy', price: shortTrail, trigger: 'above', note: '2.5 ATR trail' },
      { side: 'buy', price: shortStop, trigger: 'above', note: '5 ATR disaster stop' }
    ] : [])
  ]);

  if (pos === 0) {
    const crossUp = emaF2 <= emaS && emaF1 > emaS;
    const crossDn = emaF2 >= emaS && emaF1 < emaS;
    if (crossUp && funding > 0) return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
    if (crossDn && funding < 0) return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.5 };
    return null;
  }

  if (pos > 0) {
    if (ctx.price > ref) { ctx.state.ref = ctx.price; ref = ctx.price; }
    if (ctx.price <= ref - trailMult * atr1 || ctx.price <= entry - stopMult * atr1) {
      ctx.state.ref = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  // short
  if (ctx.price < ref) { ctx.state.ref = ctx.price; ref = ctx.price; }
  if (ctx.price >= ref + trailMult * atr1 || ctx.price >= entry + stopMult * atr1) {
    ctx.state.ref = null;
    return { side: 'buy', qty: -pos, reduceOnly: true };
  }
  return null;
}
