/*
 * @coinsori-strategy v1
 * name: BTC Regime Filter Trend Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Rides BTC's uptrend while volatility is calm and steps out when volatility explodes.
 * Buys when price is above a 300-bar SMA and ATR is below 1.2x its 60-bar median; sells only
 * when ATR rises above 2.2x its median (a volatility spike, usually a blow-off top or crash),
 * or if price falls 8xATR below entry (a catastrophe guard, not a normal stop).
 * Loses when BTC grinds sideways with moderate volatility for a long time — no exit fires and
 * the position just sits; also misses the last leg of a melt-up if vol stays low to the end.
 */

function onUpdate(ctx) {
  const sma = ctx.sma(300, 1);
  const atr = ctx.atr(14, 1);
  if (sma == null || atr == null) return null;

  // Median ATR over the last 60 closed bars = the "normal" calm level for this market.
  const atrVals = [];
  for (let i = 1; i <= 60; i++) {
    const v = ctx.atr(14, i);
    if (v == null) return null;
    atrVals.push(v);
  }
  const sorted = atrVals.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const atrMed = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const price = ctx.closes.at(-2);
  if (price == null) return null;

  const inPos = ctx.position > 0;
  const above = price > sma;
  // 1.2x median = calm enough to enter; 2.2x median = too wild, get out.
  const calm = atr < 1.2 * atrMed;
  const wild = atr > 2.2 * atrMed;

  if (inPos) {
    // Wide catastrophe guard only — 8xATR never cuts normal pullbacks, only true disasters.
    const stop = ctx.entryPx != null ? ctx.entryPx - 8 * atr : null;
    const watchList = [];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'catastrophe guard' });
    if (wild) watchList.push({ side: 'sell', price: price, trigger: 'below', note: 'vol spike exit', conds: [
      { label: 'ATR/median', now: +(atr / atrMed).toFixed(2), op: '>', ref: 2.2, closed: true }
    ]});
    ctx.watch(watchList);
    if (stop != null && price <= stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (wild) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'calm uptrend entry', conds: [
      { label: 'price > SMA300', ok: above },
      { label: 'ATR calm', ok: calm }
    ]}
  ]);
  if (above && calm) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
