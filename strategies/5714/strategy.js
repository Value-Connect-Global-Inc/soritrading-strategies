/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Vol-Target Size 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure 200-day trend (strategy 5710) is this job's best
 * result but its one weakness is the ride-down: it stays 100% invested through
 * the crash and gives back a 33% drawdown before the slow 200-day exit fires.
 * Changing WHEN we exit (ATR or Donchian trailing stops) only added whipsaw.
 * This version keeps the exact same entry/exit signal and instead scales HOW
 * MUCH we buy: when daily volatility is high (a crash regime), we invest less;
 * when volatility is calm, we are fully invested. Same trades, smaller drawdown.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average. Position size = min(1, 3% / ATR(20)-as-percent-of-price) of cash,
 * so a day-to-day move of 3% means 100% invested, a 6% move means 50%.
 * Sells when the close falls below the 200-day average. No other exits.
 * When it does NOT work: In a long sideways range it whipsaws across the
 * 200-day line. It lags sharp V-shaped recoveries. Because it is under-invested
 * in high-volatility bull spikes (e.g. early 2021), it can miss part of a
 * violent rally — it trades some upside for lower drawdown.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // allocation engine must be healthy before opening new positions (reduce-only edge otherwise)
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    // vol-target: 3% daily ATR = full size, scale down linearly as vol rises
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
