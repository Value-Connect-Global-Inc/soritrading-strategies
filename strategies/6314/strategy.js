/*
 * @coinsori-strategy v1
 * name: BTC Channel Regime Timer 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC makes long, strong trends on the 4h chart, separated by long sideways
 * and down phases. Staying long only while price keeps making new 200-bar highs keeps us in the
 * whole trend, and stepping out only when price breaks a 200-bar low avoids most of the chop that
 * whipsaws faster filters.
 * When it buys and sells: buys (full size) when the close breaks above the 200-bar high; sells
 * everything when the close breaks below the 200-bar low.
 * When it does NOT work: the 200-bar exit gives back a large part of any reversal, so in markets
 * that top out and reverse hard the drawdown is big. It is long-only, so it never profits from a
 * bear market.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null) return null;

  // ago=2: the 200 highs / 200 lows BEFORE the last closed bar, so the break is real.
  const hi200 = ctx.high(200, 2);
  const lo200 = ctx.low(200, 2);
  if (hi200 == null || lo200 == null) return null;

  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  ctx.watch([
    { side: 'buy', price: hi200, trigger: 'above', note: 'close above 200-bar high' },
    { side: 'sell', price: lo200, trigger: 'below', note: 'close below 200-bar low' }
  ]);

  if (pos > 0) {
    if (prevClose < lo200) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (prevClose > hi200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  return null;
}
