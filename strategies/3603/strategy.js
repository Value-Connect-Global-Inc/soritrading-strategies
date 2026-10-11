/*
 * @coinsori-strategy v1
 * name: Hashrate Trend Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's hash rate (mining power) is a real, hard-to-fake
 * fundamental. When the network is growing and price is above its long-term average,
 * the uptrend has fundamental backing. Bet: fundamentals confirm the trend.
 * When it buys and sells: buys when the close is above the 200-day average AND the
 * hash rate is above its own 30-day average (network accelerating). Sells when the
 * close drops below the 200-day average, or the hash rate falls below its 30-day
 * average, or price drops 3x ATR below entry (hard stop).
 * When it does NOT work: hash rate is a slow, lagging signal — in a fast crash it
 * reacts late, so the hard stop carries the risk. In a long bear market it sits in
 * cash (safe but flat). Needs the hashrate data (available from 2009).
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const hs = ctx.data('hashrate_sma30'); // smoothed hash rate — already averaged
  const hsRaw = ctx.data('hashrate');
  if (sma200 == null || atr == null || hs == null || hsRaw == null) return null;
  const prevClose = ctx.closes.at(-2); // last CLOSED bar — same in backtest and live
  if (prevClose == null) return null;

  const inPos = ctx.position > 0;

  if (inPos) {
    // hard stop: 3x ATR below entry — caps the loss on any single trade
    const hardStop = ctx.entryPx - 3 * atr;
    if (prevClose <= hardStop) return { side: 'sell', qty: ctx.position };
    // long-term price trend broken — get out
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position };
    // network no longer accelerating — the fundamental support is gone
    if (hsRaw < hs) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' },
               { side: 'sell', price: prevClose, trigger: 'above', note: 'hashrate exit',
                 conds: [{ label: 'Hashrate > SMA30', now: hsRaw, op: '>', ref: hs, closed: true }] }]);
    return null;
  }

  // entry: long-term uptrend intact AND the network is growing (hash rate above its own 30-day average)
  if (prevClose <= sma200) return null;
  if (hsRaw <= hs) return null;

  const qty = (ctx.cash * 0.98) / ctx.price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend filter',
               conds: [{ label: 'Hashrate > SMA30', now: hsRaw, op: '>', ref: hs, closed: true }] }]);
  return { side: 'buy', qty };
}
