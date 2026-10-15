/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys when the latest DXY is ABOVE its 20-value
 * rolling average. If this trades while the cur<avg variant never does, the fed
 * DXY series is strictly rising in the backtest feed (data misalignment), which
 * makes a below-average regime structurally impossible.
 * When it buys and sells: buys on first bar with cur > avg; holds forever.
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
  if (ctx.position === 0 && cur > avg) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
