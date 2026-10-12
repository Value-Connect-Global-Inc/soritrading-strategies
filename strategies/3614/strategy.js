/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: markets overreact, then snap back. When price is stretched
 *   far below its average band and momentum is exhausted (RSI very low), the
 *   odds favour a bounce toward the mean. This is the opposite bet from the
 *   trend riders built in earlier cycles — a mean-reversion family.
 * When it buys and sells: buy when RSI(14) is below 30 and the close is below
 *   the lower Bollinger band (20,2); sell when the close climbs back above the
 *   middle band or RSI recovers above 55, or a 1.5x ATR hard stop is hit.
 * When it does NOT work: in a strong downtrend price keeps falling below the
 *   band and the hard stop is hit again and again — it bleeds slowly. It also
 *   sits in cash through big trending rallies and misses them entirely.
 */
function onUpdate(ctx) {
  const st = ctx.state || {};
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || bb == null || atr == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 1.5 * atr;
    if (price <= hardStop || prevClose >= bb.mid || rsi >= 55) {
      st.lastExit = ctx.i;
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '1.5x ATR hard stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'revert to mean' }]);
    return null;
  }

  if (rsi >= 30) return null;              // only enter when momentum is exhausted
  if (prevClose >= bb.lower) return null;  // only enter stretched below the lower band
  if (st.lastExit != null && ctx.i - st.lastExit < 10) return null;  // cooldown: don't re-catch the same knife

  // risk 1% of cash on the 1.5x ATR stop (tight stop = small size, cannot ruin the account)
  const riskCash = ctx.cash * 0.01;
  const stopDist = 1.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
