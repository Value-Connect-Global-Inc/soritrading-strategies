/*
 * @coinsori-strategy v1
 * name: DIAG dxy probe
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Diagnostic only — checks whether the dxy dataset value reaches the backtest and whether the key is visible in ctx.dataKeys.
 * When it buys and sells: Buys once when a non-null dxy value is first seen, then logs. Never sells.
 * When it does NOT work: It is a probe, not a real strategy; ignore its P&L.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const keys = ctx.dataKeys;
  const st = ctx.state;
  if (st.n == null) st.n = 0;
  st.n++;
  if (st.logged == null) st.logged = false;
  if (st.n % 60 === 0 || (dxy != null && !st.logged)) {
    ctx.log('i=' + st.n + ' dxy=' + dxy + ' keys=' + JSON.stringify(keys));
    if (dxy != null) st.logged = true;
  }
  if (st.logged && st.bought == null) {
    st.bought = true;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
