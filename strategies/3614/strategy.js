/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: markets overreact and then snap back — but only when there
 *   is a mean to revert to. The plain version (no regime filter) failed on all
 *   three windows because it kept fading downtrends. This version only buys
 *   dips inside an uptrend (price above its 200-EMA): the dip is temporary, the
 *   trend is not.
 * When it buys and sells: buy when RSI(14) is below 30, the close is below the
 *   lower Bollinger band (20,2) AND the close is above the 200-EMA; sell when
 *   the close climbs back above the middle band or RSI recovers above 55, or a
 *   1.5x ATR hard stop is hit.
 * When it does NOT work: in a choppy market the 200-EMA filter lets it in and
 *   out too often; in a bear market it never buys, so it just sits in cash and
 *   misses the bottom. It also bleeds if a strong uptrend reverses hard.
 */
function onUpdate(ctx) {
  const st = ctx.state || {};
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  const ema200 = ctx.ema(200, 1);
  if (rsi == null || bb == null || atr == null || ema200 == null) return null;

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
  if (prevClose <= ema200) return null;    // regime guard: only fade dips in an uptrend
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
