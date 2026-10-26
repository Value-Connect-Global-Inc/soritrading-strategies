/*
 * @coinsori-strategy v1
 * name: BTC YieldCurve-Gate VolTarget 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The yield-curve gate (10Y-2Y spread > 0 = risk-on) is a sound macro filter, but full-position entries in crypto create 60-90% drawdowns. This version sizes every position by volatility: risk only ~5% of equity per 2.5 ATR adverse move, so a stop-loss can never bankrupt the account. The drawdown is capped by construction, not by hoping the signal is right.
 * When it buys and sells: Buy on a 20-day breakout while the 10Y-2Y spread is positive. Position size = equity * 5% / (2.5 * ATR), so the hard stop costs at most ~5% of the account. Sell on the 10-day low break or the 2.5x ATR hard stop.
 * When it does NOT work: In a long crypto bear with a positive curve (e.g. 2018 altcoin winter), the gate lets whipsaw trades in and the small position means little upside while drawdown stays small. Heavy ATR spikes cut position size sharply (conservative).
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
    // Vol-target size: risk 5% of equity on a 2.5x ATR stop.
    // 5% is conservative enough to survive repeated stops; 2.5 ATR is a wide but honest stop.
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
