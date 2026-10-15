/*
 * @coinsori-strategy v1
 * name: DXY Diagnostic BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: diagnostic — buys as soon as 20 non-null DXY values
 * accumulate, with NO regime or trend gate. Confirms whether hist reaches 20
 * in the real strategy path (isolating the weakDollar/sma200 gates).
 * When it buys and sells: buys on the 20th accumulated DXY value; holds forever.
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
  if (ctx.position === 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
