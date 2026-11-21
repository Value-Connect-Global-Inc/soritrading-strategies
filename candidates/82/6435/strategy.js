/*
 * @coinsori-strategy v1
 * name: BTC 4H SMA1000 Long-Short Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: long-only regime filters lose to buy-and-hold because
 * they sit in cash during part of a bull run. Going SHORT in falling
 * regimes captures the down-move too, so the strategy can beat holding.
 * A slow SMA1000 (~5.5 months) defines the regime on 4h bars.
 * When it buys and sells: long when price is above SMA1000, short when
 * below. Position flips at the cross. 0.5x size so a short cannot be
 * liquidated by a sharp squeeze.
 * When it does NOT work: violent short squeezes where a short is forced to
 * cover at a loss, and chop right at the 1000-bar line causing flip churn.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const sma = ctx.sma(1000, 1);
  if (sma == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.5; // half size: margin room for short squeezes

  if (ctx.position === 0) {
    if (price > sma) {
      ctx.watch([{ side:'buy', price: sma, trigger:'above', note:'SMA1000 long' }]);
      return { side:'buy', qty: qty };
    }
    if (price < sma) {
      ctx.watch([{ side:'sell', price: sma, trigger:'below', note:'SMA1000 short' }]);
      return { side:'sell', qty: qty };
    }
    return null;
  }

  // Flip when the regime changes.
  const long = ctx.position > 0;
  ctx.watch([
    { side:'sell', price: sma, trigger:'below', note:'flip to short' },
    { side:'buy', price: sma, trigger:'above', note:'flip to long' }
  ]);
  if (long && price < sma) return { side:'sell', qty: ctx.position + qty, reduceOnly: true };
  if (!long && price > sma) return { side:'buy', qty: -ctx.position + qty, reduceOnly: true };
  return null;
}
