/*
 * @coinsori-strategy v1
 * name: BTC 4H Contrarian Funding Trend
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The funding-z gate (block high funding) failed against its no-gate
 * baseline, so this is the OTHER funding shape: contrarian. When funding is unusually
 * NEGATIVE, shorts are crowded and paying longs — historically a squeeze fuel. We only
 * act on that signal inside a confirmed uptrend, so we are buying short-crowding pullbacks
 * within a bull trend, not catching falling knives.
 * When it buys and sells: Buy when the 4h trend is up (EMA50 above EMA200, price above
 * EMA50) AND funding z-score vs its own ~6-week history is below -1 (shorts crowded).
 * Sell when the trend breaks or price falls -25% from entry.
 * When it does NOT work: in a persistent bear market funding stays deeply negative for
 * months while the trend filter keeps us flat (no harm, no gain); in a calm bull with
 * mildly positive funding the -1 trigger rarely fires, so we sit out most of the move.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const fund = ctx.funding;
  if (fund == null) { ctx.watch([]); return null; }

  const hist = ctx.state.fundHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== fund) {
    hist.push(fund);
    if (hist.length > 250) hist.shift();
    ctx.state.fundHist = hist;
  }
  let fundZ = 0;
  if (hist.length >= 60) {
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length) || 1e-6;
    fundZ = (fund - mean) / sd;
  }

  const trendUp = ema50 > ema200 && prevClose > ema50;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (trendUp && fundZ < -1) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up, shorts crowded', conds: [{ label: 'fund z<-1', ok: fundZ < -1 }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up + short crowding', conds: [{ label: 'fund z<-1', ok: fundZ < -1 }] }]);
  return null;
}
