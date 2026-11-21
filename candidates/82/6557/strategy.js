/*
 * @coinsori-strategy v1
 * name: Multi-Asset Trend Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto alts trend together but with different strength. Holding a basket
 * of the biggest coins and only being long each one while it is in a clear uptrend (price above
 * a RISING 200-bar SMA) captures the strongest trends and sidesteps each coin's own crashes.
 * A rising-SMA requirement filters out dead-cat bounces inside a downtrend so we do not re-enter
 * a falling coin too early. Vol-targeted sizing keeps any single coin from dominating the account.
 * When it buys and sells: For each coin, buy a slice when the last closed bar closes above a
 * RISING 200-bar SMA; sell that slice when it closes below the SMA (or hits a hard stop). Each
 * coin is independent, so the basket is diversified across assets and time.
 * When it does NOT work: In a broad crypto bear market every coin is below its SMA and the basket
 * sits in cash (fine, but no return). In a long sideways chop the rising-SMA filter churns and
 * fees accumulate. Alts can crash faster than the 4h SMA reacts, so a hard stop is kept on each.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rising SMA: current SMA above the SMA 20 bars ago (about 3 days) = uptrend regime
  const smaPast = ctx.sma(200, 21);
  const rising = smaPast != null ? sma200 > smaPast : true;
  const pos = ctx.position || 0;

  // target slice: equal weight across the 5-coin basket, scaled by a vol target (ATR/price)
  const atr = ctx.atr(14, 1);
  const slice = 1 / 5;
  const volScale = atr != null ? Math.min(1, 0.03 / (atr / ctx.price)) : 1;
  const targetQty = (ctx.cash / ctx.price) * slice * volScale;

  if (pos > 0) {
    // hard stop: exit if price falls 8% below our entry, or SMA-2% breakdown
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.92 : null;
    const exitLvl = sma200 * 0.98;
    ctx.watch([{ side:'sell', price: exitLvl, trigger:'below', note:'SMA200 breakdown' },
               { side:'sell', price: stop, trigger:'below', note:'8% hard stop' }]);
    if (prevClose < exitLvl || (stop != null && prevClose < stop)) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // enter only when above a RISING SMA (uptrend) — avoids re-entering a falling coin
  const enterLvl = sma200 * 1.02;
  ctx.watch([{ side:'buy', price: enterLvl, trigger:'above', note:'RISING SMA200 uptrend', conds:[{label:'SMA rising', ok: rising}] }]);
  if (rising && prevClose > enterLvl) {
    return { side:'buy', qty: targetQty };
  }
  return null;
}
