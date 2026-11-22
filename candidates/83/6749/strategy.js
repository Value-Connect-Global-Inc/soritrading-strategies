/*
 * @coinsori-strategy v1
 * name: PROBE 6744 logged SOL 4H
 * ex: binanceusdm
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Diagnostic: exact copy of 6744 with ctx.log at decision points,
 * to find why it only ever completes one trade.
 */
function onUpdate(ctx) {
  const fRaw = ctx.funding;
  if (fRaw != null) ctx.state.lastFunding = fRaw;
  const f = ctx.state.lastFunding;
  if (f == null) { ctx.log('bar=' + ctx.i + ' funding null'); ctx.watch([]); return null; }

  const hist = ctx.state.fundingHist || [];
  hist.push(f);
  if (hist.length > 80) hist.shift();
  ctx.state.fundingHist = hist;
  if (hist.length < 60) { ctx.log('bar=' + ctx.i + ' hist=' + hist.length); ctx.watch([]); return null; }

  const win = hist.slice(-60);
  let below = 0;
  for (let k = 0; k < 60; k++) if (win[k] <= f) below++;
  const pct = below / 60;

  const sma20 = ctx.sma(20, 1);
  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma20 == null || sma100 == null || atr == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);
  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const stopDist = 2.5 * atr;

  if (pos > 0) {
    const stop = (entry == null ? price : entry) - stopDist;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'MR back to SMA20' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    if (price >= sma20 || price <= stop) {
      ctx.log('bar=' + ctx.i + ' EXIT long price=' + price.toFixed(2) + ' sma20=' + sma20.toFixed(2) + ' stop=' + stop.toFixed(2));
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.log('bar=' + ctx.i + ' HOLD long price=' + price.toFixed(2) + ' sma20=' + sma20.toFixed(2));
    return null;
  }
  if (pos < 0) {
    const stop = (entry == null ? price : entry) + stopDist;
    ctx.watch([
      { side: 'buy', price: sma20, trigger: 'below', note: 'MR back to SMA20' },
      { side: 'buy', price: stop, trigger: 'above', note: 'hard stop' }
    ]);
    if (price <= sma20 || price >= stop) {
      ctx.log('bar=' + ctx.i + ' EXIT short price=' + price.toFixed(2) + ' sma20=' + sma20.toFixed(2) + ' stop=' + stop.toFixed(2));
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    ctx.log('bar=' + ctx.i + ' HOLD short price=' + price.toFixed(2) + ' sma20=' + sma20.toFixed(2));
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') {
    ctx.log('bar=' + ctx.i + ' alloc=' + ctx.alloc.status);
    ctx.watch([]);
    return null;
  }

  const qty = (ctx.cash * 0.02) / stopDist;

  if (pct < 0.20 && prevClose > sma100 && price <= sma20) {
    ctx.log('bar=' + ctx.i + ' LONG ENTRY pct=' + pct.toFixed(3) + ' px=' + price.toFixed(2) + ' s20=' + sma20.toFixed(2) + ' s100=' + sma100.toFixed(2));
    ctx.watch([{ side: 'buy', price: sma20, trigger: 'below', note: 'dip to SMA20',
      conds: [{ label: 'funding pct', now: pct, op: '<', ref: 0.2, closed: true },
              { label: 'above SMA100', ok: prevClose > sma100 }] }]);
    return { side: 'buy', qty };
  }
  if (pct > 0.80 && prevClose < sma100 && price >= sma20) {
    ctx.log('bar=' + ctx.i + ' SHORT ENTRY pct=' + pct.toFixed(3) + ' px=' + price.toFixed(2) + ' s20=' + sma20.toFixed(2) + ' s100=' + sma100.toFixed(2));
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'bounce to SMA20',
      conds: [{ label: 'funding pct', now: pct, op: '>', ref: 0.8, closed: true },
              { label: 'below SMA100', ok: prevClose < sma100 }] }]);
    return { side: 'sell', qty };
  }

  ctx.log('bar=' + ctx.i + ' flat pct=' + pct.toFixed(3) + ' px=' + price.toFixed(2) + ' s20=' + sma20.toFixed(2) + ' s100=' + sma100.toFixed(2));
  ctx.watch([]);
  return null;
}
