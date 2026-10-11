/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Breakout trend-following — when price makes a fresh
 * N-bar high (a Donchian breakout) in a confirmed uptrend, momentum tends to
 * persist; we ride it until price breaks down through a shorter-term low.
 * This is the classic trend family (buy strength, not dips), the opposite of
 * the pullback strategies tested before, so it diversifies the user's book.
 * When it buys and sells: buy when the last closed bar breaks above the
 * highest high of the previous 55 bars AND the 50-EMA is above the 200-EMA.
 * Sell when price closes below the lowest low of the previous 20 bars, or on
 * a 2x ATR stop from entry.
 * When it does NOT work: in a sideways range it buys false breakouts and gets
 * chopped out repeatedly. It also gives back gains in sharp V-reversals
 * (breakout up, reversal down) because the exit lags. Start-up whipsaws are
 * the cost of catching the big trends.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hi55 = ctx.high(55, 1);   // highest high of last 55 CLOSED bars
  const lo20 = ctx.low(20, 1);    // lowest low of last 20 CLOSED bars
  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (hi55 == null || lo20 == null || f == null || s == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    // trend broke: closed below the 20-bar low
    if (price < lo20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: '20-bar low break' }]);
    return null;
  }

  // fresh breakout above 55-bar high
  if (price <= hi55) return null;
  // only in a confirmed uptrend
  if (f <= s) return null;

  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
