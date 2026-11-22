/*
 * @coinsori-strategy v1
 * name: PROBE funding-fade entry SOL 4H
 * ex: binanceusdm
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Diagnostic: how often do 6744's exact ENTRY conditions fire?
 * Same funding percentile + SMA100 trend filter + SMA20 pullback as 6744,
 * but exits next bar so every qualifying bar becomes a trade.
 * Many trades = entry conditions are not the bottleneck (bug is elsewhere).
 */
function onUpdate(ctx) {
  const fRaw = ctx.funding;
  if (fRaw != null) ctx.state.lastFunding = fRaw;
  const f = ctx.state.lastFunding;
  if (f == null) { ctx.watch([]); return null; }
  const hist = ctx.state.fundingHist || [];
  hist.push(f);
  if (hist.length > 80) hist.shift();
  ctx.state.fundingHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const win = hist.slice(-60);
  let below = 0;
  for (let k = 0; k < 60; k++) if (win[k] <= f) below++;
  const pct = below / 60;

  const sma20 = ctx.sma(20, 1);
  const sma100 = ctx.sma(100, 1);
  if (sma20 == null || sma100 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'above', note: 'exit next bar' }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (ctx.position < 0) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'below', note: 'exit next bar' }]);
    return { side: 'buy', qty: -ctx.position, reduceOnly: true };
  }
  if (pct < 0.20 && prevClose > sma100 && price <= sma20) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'below', note: 'long entry' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (pct > 0.80 && prevClose < sma100 && price >= sma20) {
    ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'above', note: 'short entry' }]);
    return { side: 'sell', qty: ctx.cash / ctx.price * 0.99 };
  }
  ctx.watch([]);
  return null;
}
