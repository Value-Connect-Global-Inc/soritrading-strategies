/*
 * @coinsori-strategy v1
 * name: Band-Bounce Mean Reversion TRX 4H
 * ex: binance
 * syms: TRXUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated champion recipe applied to TRX 4h, a fresh
 * large-cap not yet in the family's proven set. Tests whether the defensive
 * mean-reversion edge extends to a very stable large-cap. Unchanged recipe.
 * When it buys and sells: buys when price closes below the lower Bollinger(20,2)
 * with RSI<30 while price is above the 200-SMA; exits at the middle band / RSI>50
 * or a 6-ATR stop; then waits 5 bars before re-entering.
 * When it does NOT work: lags strong melt-ups; below the 200-SMA it never buys;
 * a panic that keeps falling still loses. Defensive, not a trend rider.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || rsi == null || sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const entryPx = ctx.entryPx;
    const stopPrice = atr != null && entryPx != null ? entryPx - atr * 6 : null;
    const watch = [
      { side: 'sell', price: bb.mid, trigger: 'above', qty: pos, note: '중간밴드 익절' },
      { side: 'sell', qty: pos, note: 'RSI>50 청산', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] }
    ];
    if (stopPrice != null) watch.push({ side: 'sell', price: stopPrice, trigger: 'below', qty: pos, note: '6 ATR 손절' });
    ctx.watch(watch);

    if (price >= bb.mid || rsi > 50) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (atr != null && price <= ctx.entryPx - atr * 6) {
      ctx.state = ctx.state || {};
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const lastExit = ctx.state.lastExit || 0;
  const cooldownOk = ctx.i - lastExit >= 5;
  const aboveSma = price >= sma200;
  const entryWatch = {
    side: 'buy',
    price: bb.lower,
    trigger: 'below',
    qty: ctx.cash / ctx.price * 0.95,
    note: 'BB 하단 + RSI<30 매수',
    conds: [
      { label: '5-bar cooldown', ok: cooldownOk },
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 close', now: price, op: '>=', ref: sma200, closed: false }
    ]
  };
  ctx.watch([entryWatch]);

  if (!cooldownOk) return null;

  if (price < sma200) return null;

  if (price < bb.lower && rsi < 30) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
