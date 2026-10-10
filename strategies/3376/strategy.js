/*
 * @coinsori-strategy v1
 * name: DIAG state-share test
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: pure diagnostic. It buys as soon as it has seen 2+ different symbols
 * in ctx.state. If ctx.state is SHARED across symbols in a multi-symbol backtest, it buys
 * on bar 2. If each symbol gets its own isolated ctx.state, it never sees a second symbol
 * and never trades. The result tells us which one the engine does.
 * When it buys and sells: buys once, holds forever.
 * When it does NOT work: diagnostic only — no trading logic to evaluate.
 */

function onUpdate(ctx) {
  if (!ctx.state.n) ctx.state.n = {};
  ctx.state.n[ctx.sym] = (ctx.state.n[ctx.sym] || 0) + 1;
  const count = Object.keys(ctx.state.n).length;
  if (count >= 2 && ctx.position === 0) {
    return { side: 'buy', qty: 0.01 };
  }
  return null;
}
