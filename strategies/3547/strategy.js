/*
 * @coinsori-strategy v1
 * name: Funding Diagnostic
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Diagnostic probe — trades whenever ctx.funding is non-null to test whether funding data reaches the strategy in a backtest.
 * When it buys and sells: Buys whenever funding is present and flat; sells after 10 bars. No real edge.
 * When it does NOT work: Not a real strategy.
 */
function onUpdate(ctx) {
  const f = ctx.funding;
  if (f == null) return null;
  if (ctx.position > 0) {
    const held = ctx.state.held != null ? ctx.state.held + 1 : 1;
    ctx.state.held = held;
    if (held >= 10) { ctx.state.held = 0; return { side: 'sell', qty: ctx.position }; }
    return null;
  }
  ctx.state.held = 0;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
