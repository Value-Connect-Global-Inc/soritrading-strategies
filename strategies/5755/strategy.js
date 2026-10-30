/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength + Hard Stop 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated ETH 200-SMA trend ride with trend-strength
 * position sizing (risk more per trade when price is far above the trend line).
 * The proven version has no hard stop — it only exits on a close below the
 * 200-SMA, so a single fast crash can ride all the way down to the trend line
 * (MDD ~49%). This adds a hard 20% stop-loss below entry so a black-swan gap
 * cannot run the full distance. Pure risk control: entries and the normal trend
 * exit are unchanged.
 * When it buys and sells: long on a close above the 200-SMA (fresh cross), sized
 * by risk/ATR where risk grows with trend strength. Sells on a close below the
 * 200-SMA, OR immediately if price falls 20% below entry (hard stop).
 * When it does NOT work: in sideways chop the cross whipsaws; a strong-looking
 * false breakout loses more than flat sizing; the hard stop can lock in a loss
 * on a fast dip that would have recovered above the trend line.
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
    const entryPx = ctx.entryPx;
    const stopPx = (entryPx != null) ? entryPx * 0.80 : null; // hard 20% stop below entry
    const watch = [{ side: 'sell', price: sma, trigger: 'below', note: 'close<200d avg' }];
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: '20% hard stop' });
    ctx.watch(watch);
    if (closePrev < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stopPx != null && price <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'cross above 200d avg' }]);

  if (closePrev2 <= smaP && closePrev > sma) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
    const distPct = (closePrev - sma) / sma;
    const risk = 300 + Math.min(Math.max(distPct * 20000, 0), 1200);
    const riskQty = risk / atr;
    const maxQty = (ctx.cash / price) * 0.98;
    const qty = Math.min(riskQty, maxQty);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
