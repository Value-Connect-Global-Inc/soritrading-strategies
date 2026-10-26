/*
 * @coinsori-strategy v1
 * name: BTC Yield-Curve-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A positively-sloped US yield curve (10Y-2Y spread > 0) marks a risk-on macro regime where crypto trends tend to work. When the curve inverts, recession risk historically precedes weak risk assets.
 * When it buys and sells: Buy on a 20-day price breakout ONLY while the 10Y-2Y spread is positive. Sell when price breaks below the 10-day low or falls 2.5x ATR below entry (hard stop).
 * When it does NOT work: In a regime where the curve is positive but crypto is in its own bear market (e.g. 2018-19 altcoin winter, or a crypto-specific deleveraging), the gate does not protect you.
 */
function onUpdate(ctx) {
  // Macro regime: 10Y minus 2Y spread. Positive = risk-on.
  const spread = ctx.data("base_t10y2y");
  if (spread == null) return null;       // no macro data -> stay out

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // --- Hard stop: exit if price falls 2.5x ATR below entry.
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Trend exit: break below 10-day low closes the trade.
  const low10 = ctx.low(10, 1);
  if (pos > 0 && low10 != null) {
    ctx.watch([{ side:'sell', price: low10, trigger:'below', note:'10-day low break' }]);
    if (price <= low10) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Entry: 20-day breakout while yield curve is positive (risk-on).
  const hi20 = ctx.high(20, 1);
  if (pos === 0 && hi20 != null && spread > 0 && price > hi20) {
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & curve>0' }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & curve>0' }]);
  return null;
}
