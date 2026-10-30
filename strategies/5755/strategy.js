/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength + Trailing Stop 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated ETH 200-SMA trend ride with trend-strength
 * position sizing (risk more per trade when price is far above the trend line).
 * The proven version only exits on a close below the 200-SMA, so a fast crash
 * rides all the way down to the trend line (MDD ~49%) and pullbacks inside a
 * rising market give back most of the gain. This adds a trailing stop at 20%
 * below the highest price since entry, so profits are locked in and drawdowns
 * are cut, while the 200-SMA exit remains as the trend backstop.
 * When it buys and sells: long on a close above the 200-SMA (fresh cross), sized
 * by risk/ATR where risk grows with trend strength. Sells on a close below the
 * 200-SMA, OR immediately if price falls 20% below its peak since entry.
 * When it does NOT work: in sideways chop the cross whipsaws; a tight trailing
 * stop exits a strong trend on a normal pullback and the re-entry is worse.
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
    // trailing peak since entry, kept in ctx.state so it survives a restart
    let peak = ctx.state.peak;
    if (peak == null || price > peak) peak = price;
    ctx.state.peak = peak;
    const trailPx = peak * 0.80; // 20% trailing stop below the peak since entry
    const stopPx = (entryPx != null) ? entryPx * 0.80 : null; // hard 20% stop below entry
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'close<200d avg' },
      { side: 'sell', price: trailPx, trigger: 'below', note: '20% trailing stop' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '20% hard stop' }
    ]);
    if (closePrev < sma) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (price <= trailPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stopPx != null && price <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.peak = null; // flat: no peak to trail
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
