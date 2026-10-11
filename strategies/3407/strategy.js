/*
 * @coinsori-strategy v1
 * name: BTC SMA50 Trend BearSized 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A clean, robust trend strategy on the most liquid crypto,
 * using the bear-sizing principle proven on the ADA champion: ride the 50-day
 * trend at full size when price is above its 200-day average, half size below it.
 * No exotic signals — the edge is that BTC trends are durable and the bear-size
 * rule cuts the worst of the crashes. Different asset and simpler signal than the
 * ADA Donchian champion, so it diversifies the account.
 * When it buys and sells: buys when a closed bar closes above the 50-day average
 * (full size above the 200-day average, half size below it). Sells when a closed
 * bar closes back below the 50-day average, or price falls 2.5 ATR below entry.
 * When it does NOT work: In a choppy sideways market the 50-day flips whipsaw.
 * In a violent crash price gaps through any stop. A slow grinding bull with no
 * pullbacks still works, but a V-shaped reversal after a long uptrend sells near
 * the bottom of the first dip.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma50 == null || atr == null || atr <= 0) return null;

  // Bear-sizing (proven on the ADA champion): half size below the 200-day trend.
  let sizeMult = 1.0;
  if (sma200 != null && prevClose < sma200) sizeMult = 0.5;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 trend exit' }]);
    if (prevClose < sma50 || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  if (prevClose > sma50) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99) * sizeMult };
  }
  return null;
}
