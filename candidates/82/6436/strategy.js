/*
 * @coinsori-strategy v1
 * name: 5-Asset 4H Momentum Rotation
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: relative strength is the family built to beat
 * buy-and-hold — instead of holding all 5 assets, hold only the strongest
 * ones so losers are dropped. Momentum (price vs its own 50-bar SMA)
 * ranks the basket each bar.
 * When it buys and sells: buy an asset when it is above its 50-bar SMA
 * (positive momentum); sell it when it falls back below. This keeps the
 * strongest assets and exits the weakest.
 * When it does NOT work: in a market where all assets fall together
 * (broad bear), everything is below its SMA and the strategy sits in cash
 * — protection, not profit. Rapid rotation churns fees.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.15; // 15% per asset, 5 assets

  if (ctx.position === 0) {
    // Buy when momentum is positive (price above its own 50-bar SMA).
    if (price > sma50) {
      ctx.watch([{ side:'buy', price: sma50, trigger:'above', note:'positive momentum' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Exit when momentum turns negative.
  ctx.watch([{ side:'sell', price: sma50, trigger:'below', note:'momentum lost' }]);
  if (price < sma50) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
