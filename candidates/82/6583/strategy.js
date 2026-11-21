/*
 * @coinsori-strategy v1
 * name: Funding Contrarian 4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: when perpetual funding is extremely negative (shorts paying longs) inside a long-term uptrend, the crowd is short the wrong side of the trend and those shorts tend to get squeezed. Mirror on the short side. This uses positioning data (funding), not price shape alone.
 * Buys: funding z-score (rolling 30-day window) < -1.5 while price is above EMA200. Sells: funding z > +1.5 while price is below EMA200.
 * Exits: when funding normalizes back toward zero, or a hard 3xATR stop, or the EMA200 trend filter flips. Each trade risks ~1.5% of equity.
 * Fails: sideways chop (funding near zero, EMA200 whipsaws, few setups) and strong one-way trends where funding stays extreme for weeks and the contrarian side is run over before it reverts.
 */
function onUpdate(ctx) {
  const ema = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const funding = ctx.funding;
  if (ema == null || atr == null || funding == null) return null;

  // Rolling z-score of funding over ~30 days of 8h funding (on 4h bars the same funding value repeats across 3 bars).
  const W = 180;
  const hist = (ctx.state.fundHist || []).slice();
  hist.push(funding);
  if (hist.length > W) hist.shift();
  ctx.state.fundHist = hist;
  if (hist.length < 60) return null; // need enough history for a stable mean/std

  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += hist[i];
  const mean = sum / hist.length;
  let ss = 0;
  for (let i = 0; i < hist.length; i++) { const d = hist[i] - mean; ss += d * d; }
  const sd = Math.sqrt(ss / hist.length);
  if (!(sd > 0)) return null;
  const z = (funding - mean) / sd;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // Risk 1.5% of equity per trade at a 3xATR stop; cap leverage at 3x so a stop cannot wipe the account.
  const stopDist = 3 * atr;
  const qty = Math.min(0.015 * ctx.cash / stopDist, ctx.cash * 3 / price);
  if (!(qty > 0)) return null;

  if (pos > 0) {
    if (entryPx == null) { ctx.watch([]); return null; }
    const stop = entryPx - stopDist;
    const trendBroken = price < ema;
    const fundBack = z >= 0; // funding normalized -> edge gone
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' },
      { side: 'sell', price: ema, trigger: 'below', note: 'trend broken' }
    ]);
    if (trendBroken || fundBack) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    if (entryPx == null) { ctx.watch([]); return null; }
    const ep = Math.abs(entryPx);
    const stop = ep + stopDist;
    const trendBroken = price > ema;
    const fundBack = z <= 0;
    ctx.watch([
      { side: 'buy', price: stop, trigger: 'above', note: 'hard stop' },
      { side: 'buy', price: ema, trigger: 'above', note: 'trend broken' }
    ]);
    if (trendBroken || fundBack) return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }

  // Flat: fade extreme crowding in the direction of the long-term trend.
  if (z < -1.5 && price > ema) {
    ctx.watch([{ side: 'buy', price: ema, trigger: 'above', note: 'long squeeze setup', conds: [{ label: 'funding z', now: z, op: '<', ref: -1.5 }] }]);
    return { side: 'buy', qty: qty };
  }
  if (z > 1.5 && price < ema) {
    ctx.watch([{ side: 'sell', price: ema, trigger: 'below', note: 'short unwind setup', conds: [{ label: 'funding z', now: z, op: '>', ref: 1.5 }] }]);
    return { side: 'sell', qty: qty };
  }

  // No setup: still declare what each side is waiting for.
  ctx.watch([
    { side: 'buy', price: ema, trigger: 'above', note: 'long if funding z<-1.5', conds: [{ label: 'funding z', now: z, op: '<', ref: -1.5 }] },
    { side: 'sell', price: ema, trigger: 'below', note: 'short if funding z>1.5', conds: [{ label: 'funding z', now: z, op: '>', ref: 1.5 }] }
  ]);
  return null;
}
