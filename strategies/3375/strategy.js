/*
 * @coinsori-strategy v1
 * name: DIAG state-sharing test
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: pure diagnostic — determines whether ctx.state is shared across
 * symbols in a multi-symbol backtest run. If shared, it buys on bar 2. If not, 0 trades.
 * When it buys and sells: buys once when it has seen 2 different symbols, never sells.
 * When it does NOT work: irrelevant — diagnostic only.
 *
 * 2026-02-03: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
 */

function onUpdate(ctx) {
  if (!ctx.state.visits) ctx.state.visits = {};
  ctx.state.visits[ctx.sym] = (ctx.state.visits[ctx.sym] || 0) + 1;
  const n = Object.keys(ctx.state.visits).length;
  if (n >= 2 && ctx.position === 0) {
    ctx.watch([{ side: 'buy', note: '2 symbols seen', conds: [{ label: 'distinct symbols', now: n, op: '>=', ref: 2 }] }]);
    return { side: 'buy', qty: 0.001 };
  }
  ctx.watch([]);
  return null;
}
