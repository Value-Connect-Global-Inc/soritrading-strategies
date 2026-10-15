/*
 * @coinsori-strategy v1
 * name: Fear-Greed + Hashrate Confirmation (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed Index measures crowd mood; hashrate
 * measures real miner investment in the network. A bull market backed by BOTH
 * crowd greed AND growing mining capacity is more durable than greed alone.
 * This layers the miner-conviction signal (on-chain) on top of the validated
 * sentiment-regime edge (strategies 4516-4518).
 * When it buys and sells: buys when F&G >= 55 AND hashrate is above its 30-day
 * average; sells when F&G drops to 40, when hashrate falls back below its
 * 30-day average, or when a 25% hard stop is hit.
 * When it does NOT work: in a speculative bubble where price rallies without
 * network growth, and in fast V-shaped crashes where sentiment lags price so
 * the stop does the work. Hashrate is slow to fall, so it cannot catch the top.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (fg == null || hr == null || hrAvg == null) return null; // unknown signals = stay flat

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75; // hard stop 25% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg <= 40) return { side: 'sell', qty: pos };
    if (hr < hrAvg) return { side: 'sell', qty: pos }; // miners losing conviction = exit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: 40, trigger: 'below', note: 'exit: F&G<=40 or hashrate<avg',
                 conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 40, closed: true },
                         { label: 'hashrate > 30d avg', ok: hr > hrAvg, closed: true }] }]);
    return null;
  }

  const enter = fg >= 55 && hr > hrAvg; // greed + miner conviction both confirm
  ctx.watch([{ side: 'buy', price: 55, trigger: 'above', note: 'enter: F&G>=55 & hashrate>avg',
               conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
                       { label: 'hashrate > 30d avg', ok: hr > hrAvg, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
