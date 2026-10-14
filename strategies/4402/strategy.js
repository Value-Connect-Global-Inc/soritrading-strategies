/*
 * @coinsori-strategy v1
 * name: State Persistence Probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: probe only — increments a counter in ctx.state and buys once
 * the counter reaches 10, to test whether ctx.state persists across bars in a backtest.
 * When it buys and sells: buys once at bar 10, never sells.
 * When it does NOT work: every time — this is a probe, not a strategy.
 */
function onUpdate(ctx) {
  const st = ctx.state;
  if (st.cnt == null) st.cnt = 0;
  st.cnt++;
  if (st.cnt !== 10) return null;
  if (ctx.position > 0) return null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.5 };
}
