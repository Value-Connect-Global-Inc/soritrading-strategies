/*
 * ETH 4H Dip-Rebound 4H
 * Idea: on 4h, ETH mean-reverts inside an uptrend — sharp oversold dips
 * (RSI low + price below lower Bollinger) bounce back. Buy the dip only when
 * the medium trend (100-bar SMA) is up, so we never catch a falling knife.
 * v2: deeper oversold (RSI<30) for higher-quality dips.
 * 2024-01-15: watch 선언 추가 — 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;
  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const holding = ctx.position > 0;

  if (!holding) {
    // dip: price below lower band AND RSI oversold, but only in an uptrend
    if (price > sma100 && price < bb.lower && rsi < 30) {
      ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'oversold dip in uptrend', conds: [
        { label: 'SMA100 up', ok: price > sma100 },
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }
      ] }]);
      return { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
    // waiting for dip conditions — show the levels we need
    ctx.watch([
      { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
        { label: 'SMA100 up', ok: price > sma100 },
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }
      ] },
      { side: 'buy', price: sma100, trigger: 'above', note: 'trend up' }
    ]);
    return null;
  }

  // exit when price recovers to the middle band (mean reversion complete)
  if (price > bb.mid) {
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'below', note: 'mean reversion target', conds: [
      { label: 'price above mid', ok: price > bb.mid }
    ] }]);
    return { side: 'sell', qty: ctx.position };
  }
  // emergency exit: trend broke down, stop catching the knife
  if (price < sma100 * 0.95) {
    ctx.watch([{ side: 'sell', price: sma100 * 0.95, trigger: 'above', note: 'trend breakdown stop', conds: [
      { label: 'price below stop', ok: price < sma100 * 0.95 }
    ] }]);
    return { side: 'sell', qty: ctx.position };
  }
  // holding — show both exit levels
  ctx.watch([
    { side: 'sell', price: bb.mid, trigger: 'above', note: 'mean reversion target' },
    { side: 'sell', price: sma100 * 0.95, trigger: 'below', note: 'trend breakdown stop' }
  ]);
  return null;
}
