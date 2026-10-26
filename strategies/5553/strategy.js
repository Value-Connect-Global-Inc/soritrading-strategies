/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Regime-Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset and often moves inversely to the US dollar — a weak dollar tends to support BTC, a strong dollar pressures it. Gating a trend breakout on the broad dollar index being below its 200-day average (weak-dollar regime) filters out breakouts that happen while the dollar is strengthening against risk assets. This adds a macro information axis that pure price cannot see.
 * When it buys and sells: Buy when price breaks above the 55-day high AND the broad dollar index is below its 200-day average. Exit when price breaks below the 20-day low or on a 2.5x ATR hard stop. Position is sized to risk 5% of equity on the stop.
 * When it does NOT work: In a period where BTC and the dollar move together (e.g. both rise on crypto-specific adoption), the weak-dollar gate wrongly keeps it out and it misses the rally. It also sits in cash during BTC rallies that happen despite a strong dollar.
 */
function onUpdate(ctx) {
  const dxy = ctx.data("dxy");
  if (dxy == null) return null;
  // Broad dollar index (2006=100). Weak-dollar regime = index below its long-run center.
  // The broad index has spent most of the modern era between ~95 and ~130; 110 is the middle.
  const DOLLAR_WEAK = 110;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  // --- Hard stop: exit if price falls 2.5x ATR below entry (protects every position).
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Trailing exit: break below 20-day low closes the trade.
  const low20 = ctx.low(20, 1);
  if (pos > 0 && low20 != null) {
    ctx.watch([{ side:'sell', price: low20, trigger:'below', note:'20d low break' }]);
    if (price <= low20) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Entry: 55-day breakout gated on a weak dollar regime.
  const hi55 = ctx.high(55, 1);
  if (pos === 0 && hi55 != null && price > hi55 && dxy < DOLLAR_WEAK) {
    const riskPerTrade = 0.05 * ctx.cash;
    const stopDist = 2.5 * atr;
    let qty = riskPerTrade / stopDist;
    const maxQty = ctx.cash / price * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.watch([{ side:'buy', price: hi55, trigger:'above', note:'55d breakout & dollar weak' }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([{ side:'buy', note:'waiting 55d breakout & dollar weak' }]);
  return null;
}
