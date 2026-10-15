/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys when the latest DXY is below its own
 * 20-value rolling average (weakDollar), WITHOUT the sma200 gate. Isolates
 * whether the weakDollar condition ever fires.
 * When it buys and sells: buys on first weakDollar bar; holds forever.
 * When it does NOT work: this is a diagnostic, not a strategy.
 */
function onUpdate(ctx) {
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.hist = s.hist ?? [];
    const d = ctx.data('dxy');
    if (d != null) s.hist.push(d);
    if (s.hist.length > 20) s.hist.shift();
    s.lastBarI = ctx.i;
  }
  if (s.hist == null || s.hist.length < 20) return null;
  const cur = s.hist[s.hist.length - 1];
  const avg = s.hist.reduce((a, b) => a + b, 0) / s.hist.length;
  if (ctx.position === 0 && cur < avg) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
