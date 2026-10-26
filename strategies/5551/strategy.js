/*
 * @coinsori-strategy v1
 * name: BTC OnChain-Gated Donchian Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Trend breakouts work best when the network is actually being used. A 55-day Donchian breakout is a strong momentum signal, and gating it on rising on-chain activity (active addresses above their 30-day average) filters out low-quality breakouts that happen while usage is falling. This is a different information axis than pure price — it confirms that real users are behind the move.
 * When it buys and sells: Buy when price breaks above the 55-day high AND active addresses are above their 30-day average. Exit when price breaks below the 20-day low (lets a trend breathe) or on a 2.5x ATR hard stop. Position is sized to risk 5% of equity on the stop.
 * When it does NOT work: In a long bear market where usage stays elevated while price grinds down, the gate stays open and whipsaws the account. It also misses the earliest part of a recovery rally that happens before usage picks up.
 */
function onUpdate(ctx) {
  const addr = ctx.data("addr");
  const addrSma = ctx.data("addr_sma30");
  if (addr == null || addrSma == null || addrSma <= 0) return null;

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

  // --- Trailing exit: break below 20-day low closes the trade (wide enough to let a trend breathe).
  const low20 = ctx.low(20, 1);
  if (pos > 0 && low20 != null) {
    ctx.watch([{ side:'sell', price: low20, trigger:'below', note:'20d low break' }]);
    if (price <= low20) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
  }

  // --- Entry: 55-day breakout gated on rising on-chain usage.
  const hi55 = ctx.high(55, 1);
  if (pos === 0 && hi55 != null && price > hi55 && addr > addrSma) {
    const riskPerTrade = 0.05 * ctx.cash;
    const stopDist = 2.5 * atr;
    let qty = riskPerTrade / stopDist;
    const maxQty = ctx.cash / price * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.watch([{ side:'buy', price: hi55, trigger:'above', note:'55d breakout & usage up' }]);
    return { side:'buy', qty: qty };
  }

  ctx.watch([{ side:'buy', note:'waiting 55d breakout & usage up' }]);
  return null;
}
