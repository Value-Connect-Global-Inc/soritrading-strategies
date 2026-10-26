/*
 * @coinsori-strategy v1
 * name: BTC YieldCurve-Gate VolTarget 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The yield-curve gate (10Y-2Y spread > 0 = risk-on) filters the macro regime, and volatility-targeted sizing caps drawdown by construction. A 50-day low exit lets a breakout trend breathe and avoids whipsaw in chop. Adding a long-term trend filter (price above its 200-day average) blocks false breakouts inside a bear market.
 * When it buys and sells: Buy on a 20-day breakout while the 10Y-2Y spread is positive AND price is above its 200-day average. Position size = equity * 5% / (2.5 * ATR). Sell on a 50-day low break or the 2.5x ATR hard stop.
 * When it does NOT work: In a long crypto bear with a positive curve, the gate lets whipsaw trades in; the small position limits upside while drawdown stays small. If BTC grinds sideways well above its 200-day average, the SMA200 filter does not help and the breakout still whipsaws.
 */
function onUpdate(ctx) {
  const spread = ctx.data("base_t10y2y");
  if (spread == null) return null;

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  // --- Hard stop: exit if price falls 2.5x ATR below entry.
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Trend exit: break below 50-day low closes the trade (wide = lets trend breathe).
  const low50 = ctx.low(50, 1);
  if (pos > 0 && low50 != null) {
    ctx.watch([{ side:'sell', price: low50, trigger:'below', note:'50-day low break' }]);
    if (price <= low50) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Entry: 20-day breakout while yield curve is positive AND price above SMA200.
  // SMA200 filter = only buy breakouts inside a long-term uptrend (blocks bear-market false breakouts).
  const hi20 = ctx.high(20, 1);
  if (pos === 0 && hi20 != null && spread > 0 && price > sma200 && price > hi20) {
    // Vol-target size: risk 5% of equity on a 2.5x ATR stop.
    const riskPerTrade = 0.05 * ctx.cash;
    const stopDist = 2.5 * atr;
    let qty = riskPerTrade / stopDist;
    const maxQty = ctx.cash / price * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & curve>0 & SMA200' }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & curve>0 & SMA200' }]);
  return null;
}
