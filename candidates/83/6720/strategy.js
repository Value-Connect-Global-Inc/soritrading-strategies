/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Mean Reversion 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: after two consecutive sharply falling 4h candles (RSI(2) very low),
 * short-term sellers are usually exhausted and price bounces back toward its average.
 * When it buys and sells: it buys on extreme short-term oversold and sells when price
 * recovers (RSI(2) back above 60), at a profit target, or at a hard stop.
 * When it does NOT work: in a long sustained downtrend (bear market) where every dip
 * keeps falling — the stop-loss gets hit repeatedly and the account bleeds.
 */

function onUpdate(ctx) {
  const rsi2 = ctx.rsi(2, 1);     // closed bar: identical in backtest, paper and live
  const rsi2now = ctx.rsi(2, 0);
  if (rsi2 == null || rsi2now == null) return null;

  const pos = ctx.position || 0;
  const ep = ctx.entryPx;

  if (pos > 0) {
    if (ep == null) { ctx.watch([]); return null; }
    if (ctx.state.entryBar == null) ctx.state.entryBar = ctx.i; // a run may start holding
    const stop = ep * 0.96;    // 4% hard stop: caps the loss if the dip keeps falling
    const target = ep * 1.06;  // 6% target: captures the usual bounce size
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'stop 4%' },
      { side: 'sell', price: target, trigger: 'above', note: 'target 6%' },
      { side: 'sell', price: ctx.price, trigger: 'below', note: 'recovery exit', conds: [
        { label: 'rsi2>60', now: rsi2now, op: '>', ref: 60, closed: false }
      ]}
    ]);
    if (ctx.price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (ctx.price >= target) return { side: 'sell', qty: pos, reduceOnly: true };
    if (rsi2now > 60) return { side: 'sell', qty: pos, reduceOnly: true };
    if (ctx.i - ctx.state.entryBar >= 16) return { side: 'sell', qty: pos, reduceOnly: true }; // 2.7d time stop: free capital
    return null;
  }

  // entry: extreme short-term oversold on a closed bar
  ctx.watch([
    { side: 'buy', price: ctx.price, trigger: 'below', note: 'oversold buy', conds: [
      { label: 'rsi2<10', now: rsi2, op: '<', ref: 10, closed: true }
    ]}
  ]);
  if (rsi2 < 10) {
    ctx.state.entryBar = ctx.i;
    // size 40% of cash; the 4% stop caps the loss on that portion
    const qty = (ctx.cash * 0.4) / ctx.price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
