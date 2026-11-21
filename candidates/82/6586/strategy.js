/*
 * @coinsori-strategy v1
 * name: BTC 4H Turtle Regime Donchian
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Turtle-style trend following that only trades when the 200-bar regime is
 * bullish. Buys when price closes above the prior 100-bar high; sells when
 * price closes below the prior 100-bar low, or if price falls 8x ATR below
 * entry (catastrophic protection only).
 * Loses in long sideways ranges where breakouts fail, and it gives back a
 * large part of every trend before the 100-bar low exit fires.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const dc = ctx.donchian(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || dc == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  const inBull = price > sma200; // regime filter: only trade above the 200-bar average
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos === 0) {
    const upper = dc.upper; // prior 100-bar high (closed bars)
    const breakout = price > upper;
    ctx.watch([{
      side: 'buy', price: upper, trigger: 'above', note: 'DC100 breakout',
      conds: [{ label: 'SMA200 bull', ok: inBull, closed: true }]
    }]);
    if (inBull && allocOk && breakout) {
      return { side: 'buy', qty: (ctx.cash * 0.98) / price };
    }
    return null;
  }

  const lower = dc.lower; // prior 100-bar low (closed bars)
  let hardStop = null;
  if (entry != null) hardStop = entry - 8 * atr; // catastrophic protection, rarely hit
  const watch = [{ side: 'sell', price: lower, trigger: 'below', note: 'DC100 exit' }];
  if (hardStop != null) watch.push({ side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop' });
  ctx.watch(watch);

  const exitDc = price < lower;
  const exitStop = hardStop != null && price <= hardStop;
  if (exitDc || exitStop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
