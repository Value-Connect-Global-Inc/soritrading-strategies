/*
 * @coinsori-strategy v1
 * name: Donchian Breakout Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic turtle-style trend following — a new 55-day high signals the start of a sustained move, and getting out on a 20-day low cuts losses fast. This catches Bitcoin's powerful breakouts with less lag than slow moving-average crosses.
 * When it buys and sells: Buys when the close breaks above the highest high of the previous 55 bars. Sells when the close drops below the lowest low of the previous 20 bars.
 * When it does NOT work: In a sideways / range market price repeatedly pokes above the 55-day high and immediately falls back — each breakout costs fees. It also gives back part of a crash before the 20-day exit fires.
 */
function onUpdate(ctx) {
  const entryHigh = ctx.high(55, 1); // highest high of the previous 55 bars (closed)
  const exitLow = ctx.low(20, 1); // lowest low of the previous 20 bars (closed)
  if (entryHigh == null || exitLow == null) return null;

  if (ctx.position <= 0 && ctx.price > entryHigh) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (ctx.position > 0 && ctx.price < exitLow) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
