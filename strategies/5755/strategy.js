/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength + Re-Entry 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated ETH 200-SMA trend ride with trend-strength
 * position sizing. The proven version only re-enters on a FRESH cross above the
 * 200-SMA, so after it exits a pullback it waits for a whole new crossover and
 * misses V-shaped recoveries (it captured only +6.7% of a +113% bull). This adds
 * re-entry while flat: if price is back above the 200-SMA the trend is intact,
 * so it re-buys instead of waiting for a fresh cross.
 * When it buys and sells: long on a close above the 200-SMA (fresh cross OR
 * re-entry while flat with trend intact), sized by risk/ATR where risk grows with
 * trend strength. Sells on a close below the 200-SMA.
 * When it does NOT work: in sideways chop re-entry re-exposes it to trend
 * reversals more often; a strong-looking but false recovery loses more than
 * waiting for a fresh cross.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const closePrev = ctx.closes[ctx.closes.length - 2];
  const closePrev2 = ctx.closes[ctx.closes.length - 3];
  if (sma == null || smaP == null || closePrev == null || closePrev2 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma, trigger: 'below', note: 'close<200d avg' }]);
    if (closePrev < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: fresh cross above the SMA, OR re-entry while flat if trend is intact
  // (price back above the 200-SMA). Re-entry avoids missing V-recoveries.
  const freshCross = closePrev2 <= smaP && closePrev > sma;
  if (!freshCross && !(closePrev > sma)) {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 're-enter above 200d avg' }]);
    return null;
  }

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  const distPct = (closePrev - sma) / sma;
  const risk = 300 + Math.min(Math.max(distPct * 20000, 0), 1200);
  const riskQty = risk / atr;
  const maxQty = (ctx.cash / price) * 0.98;
  const qty = Math.min(riskQty, maxQty);
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 're-enter above 200d avg' }]);
  return { side: 'buy', qty: qty };
}
