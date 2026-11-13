/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 1H Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: after a quiet consolidation, a breakout above the 20-bar high, confirmed
 * by a rising 1h trend, tends to start a move that lasts several hours; the strategy rides it
 * and steps aside during downtrends instead of holding through them.
 * When it buys and sells: buys when price closes above the highest high of the last 20 bars
 * while EMA50 is above EMA200; sells when price breaks below the 20-bar low or hits a 3xATR stop.
 * When it does NOT work: a tight range that keeps breaking both ways pays fees on many small
 * whipsaw trades; a breakout that instantly reverses hits the stop for a quick loss.
 */

function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  // Donchian channel over the last 20 CLOSED bars (ago>=1 => no lookahead).
  const hs = ctx.highs, ls = ctx.lows;
  if (hs.length < 22 || ls.length < 22) return null;
  let hh = -Infinity, ll = Infinity;
  for (let k = hs.length - 21; k <= hs.length - 2; k++) if (hs[k] > hh) hh = hs[k];
  for (let k = ls.length - 21; k <= ls.length - 2; k++) if (ls[k] < ll) ll = ls[k];

  const uptrend = ema50 > ema200;
  const orders = [];
  const watch = [];

  if (pos <= 0) {
    if (uptrend) {
      if (price > hh) {
        orders.push({ side: 'buy', qty: ctx.cash / price * 0.98 });
      }
      watch.push({ side: 'buy', price: hh, trigger: 'above', note: '20-bar breakout', conds: [
        { label: 'EMA50>EMA200', ok: uptrend }
      ]});
    }
  } else {
    const stopPx = entry - 3 * atr;   // hard stop: 3x daily-range below entry
    const exitBreak = price < ll;      // trend broke down below 20-bar low
    const exitStop = price < stopPx;
    if (exitBreak || exitStop) {
      orders.push({ side: 'sell', qty: pos, reduceOnly: true });
    }
    watch.push({ side: 'sell', price: ll, trigger: 'below', note: '20-bar breakdown' });
    watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
  }

  ctx.watch(watch);
  return orders.length ? orders : null;
}
