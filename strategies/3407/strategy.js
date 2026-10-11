/*
 * @coinsori-strategy v1
 * name: BTC SMA50 Entry SMA200 Exit 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Asymmetric trend horizon — enter on the faster 50-day
 * average (catch trends early) but exit on the slower 200-day average (let the
 * trend run longer and avoid the 50-day whipsaw in a choppy bull). The 200-day
 * exit is the classic long-term trend line: it keeps you in a real bull through
 * its normal pullbacks and only exits when the long-term trend truly breaks.
 * When it buys and sells: buys when a closed bar closes above the 50-day average.
 * Sells when a closed bar closes below the 200-day average, or price falls
 * 2.5 ATR below entry (hard risk cap).
 * When it does NOT work: In a slow grinding bull with no pullback the 200-day
 * exit gives back a lot of profit before triggering. In a violent crash the 2.5
 * ATR stop is what actually saves you, and it can still gap. In a long bear the
 * 50-day entry keeps catching falling knives above the 200-day line.
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
  if (sma50 == null || sma200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 long-term exit' }]);
    if (prevClose < sma200 || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  if (prevClose > sma50) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
