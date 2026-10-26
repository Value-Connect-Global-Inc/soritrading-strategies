/*
 * @coinsori-strategy v1
 * name: BTC YieldCurve-Gate VolTarget 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The yield-curve gate (10Y-2Y spread > 0 = risk-on) is a sound macro filter, but full-position entries in crypto create 60-90% drawdowns. This version sizes every position by volatility: risk only ~5% of equity per 2.5 ATR adverse move, so a stop-loss can never bankrupt the account. A 50-day low exit (not a tight 10-day low) lets a breakout trend breathe and avoids whipsaw in choppy up-markets.
 * When it buys and sells: Buy on a 20-day breakout while the 10Y-2Y spread is positive. Position size = equity * 5% / (2.5 * ATR). Sell on a 50-day low break or the 2.5x ATR hard stop.
 * When it does NOT work: In a long crypto bear with a positive curve, the gate lets whipsaw trades in; the small position limits upside while drawdown stays small. A 50-day exit gives back more profit than a tight exit before triggering.
 */
function onUpdate(ctx) {
  const spread = ctx.data("base_t10y2y");
  if (spread == null) return null;

  const price = ctx.price;
  const pos = ctx.position;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

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

  // --- Entry: 20-day breakout while yield curve is positive (risk-on).
  const hi20 = ctx.high(20, 1);
  if (pos === 0 && hi20 != null && spread > 0 && price > hi20) {
    // Vol-target size: risk 5% of equity on a 2.5x ATR stop.
    const riskPerTrade = 0.05 * ctx.cash;
    const stopDist = 2.5 * atr;
    let qty = riskPerTrade / stopDist;
    const maxQty = ctx.cash / price * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.watch([{ side:'buy', price: hi20, trigger:'above', note:'20d breakout & curve>0 (vol-sized)' }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([{ side:'buy', note:'waiting 20d breakout & curve>0' }]);
  return null;
}
