/*
 * @coinsori-strategy v1
 * name: BTC 4H EMA Regime Filter
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * A regime filter: it is fully in the market while the fast 50-bar average is
 * above the slow 200-bar average (an uptrend), and fully in cash when the fast
 * average drops below the slow one (a downtrend). It holds the whole uptrend
 * instead of trading in and out, so it keeps most of the rise while avoiding
 * the worst of the falls — a similar return with a smaller drawdown than
 * holding.
 * Loses when the averages cross back and forth in a sideways market (small
 * whipsaw losses) and gives back part of the very start and end of each trend
 * because it follows averages.
 */

function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1); // fast average, last closed bar
  const emaS = ctx.ema(200, 1); // slow average, last closed bar
  if (emaF == null || emaS == null) return null;

  const pos = ctx.position || 0;
  const bull = emaF > emaS; // uptrend: fast average above slow average
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos === 0) {
    ctx.watch([{
      side: 'buy', price: emaS, trigger: 'above', note: 'fast above slow',
      conds: [{ label: 'EMA50', now: emaF, op: '>', ref: emaS, closed: true }]
    }]);
    if (bull && allocOk) {
      return { side: 'buy', qty: (ctx.cash * 0.99) / ctx.price };
    }
    return null;
  }

  ctx.watch([{ side: 'sell', price: emaS, trigger: 'below', note: 'uptrend over' }]);
  if (!bull) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
