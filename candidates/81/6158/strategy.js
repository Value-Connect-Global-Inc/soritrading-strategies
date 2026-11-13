/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Trend Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends for months, and a wide trailing stop (chandelier) rides those
 * trends through the normal pullbacks that would stop out a fixed-percent stop, while still locking
 * in profits when the trend truly reverses. The slow regime filter keeps it out of downtrends.
 * When it buys and sells: Longs when the 4h close is above its ~33-day average. Stays long until
 * price falls 12x ATR(14) below the highest point since entry (a wide trailing stop), or drops 40%
 * from entry as a catastrophic backstop.
 * When it does NOT work: In a choppy sideways market the wide stop lets profits evaporate before
 * it exits (slow and lagging); in a parabolic blowoff it exits late near the top and gives back a
 * chunk of the rally; and long-only still trails buy-and-hold in a straight bull.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 210) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;

  // account demoted/returning: no new entries, close any open position in an orderly way
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Close: account not ok' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const sma = ctx.sma(200, 1); // ~33 days on 4h: slow regime filter (ledger's promising structure)
  if (sma == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2); // last CLOSED bar, identical in backtest/live
  if (closePrev == null) { ctx.watch([]); return null; }
  const atr = ctx.atr(14, 1);
  if (atr == null) { ctx.watch([]); return null; }

  const trendUp = closePrev > sma;

  if (pos <= 0) {
    ctx.state = {};
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'Long: close above ~33d avg' }]);
    if (trendUp) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.9 };
    }
    return null;
  }

  // in position: trail the stop from the highest point since entry
  const st = ctx.state || {};
  const entryPx = ctx.entryPx;
  const hh = Math.max(st.hh != null ? st.hh : (entryPx != null ? entryPx : price), price);
  st.hh = hh;
  ctx.state = st;

  const trailStop = hh - 12 * atr; // 12x ATR(14) trailing stop: wide enough to survive normal pullbacks
  const hardStop = entryPx != null ? entryPx * 0.6 : 0; // -40% catastrophic backstop (gap protection only)
  const exitPx = Math.max(trailStop, hardStop);

  ctx.watch([
    { side: 'sell', price: exitPx, trigger: 'below', note: 'Chandelier trailing stop' }
  ]);
  if (price < exitPx) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
