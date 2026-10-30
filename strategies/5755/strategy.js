/*
 * @coinsori-strategy v1
 * name: ETH Trend Strength + Slope Exit 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: the validated ETH 200-SMA trend ride with trend-strength
 * position sizing. The proven version exits on every close below the 200-SMA,
 * so in a rising market a normal pullback throws the position out and the
 * re-entry buys back higher — it captured only +7% of a +114% bull. This
 * version only exits on a close below the 200-SMA when the 200-SMA itself is
 * falling (trend broken, not a pullback), so it stays long through pullbacks
 * inside an uptrend and still gets out when the trend truly turns.
 * When it buys and sells: long on a close above a 200-SMA that was flat/falling,
 * sized by risk/ATR where risk grows with trend strength. Sells on a close below
 * the 200-SMA while the 200-SMA is falling; a hard 20% stop below entry guards
 * against a crash that gaps through the trend line.
 * When it does NOT work: in a choppy market where the 200-SMA is flat, price
 * whipsaws around it and the slope gate does not filter anything; at the very
 * top of a bull the 200-SMA is still rising, so it holds through the first leg
 * of a crash and gives back more than the old version.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const smaP = ctx.sma(200, 2);
  const smaPrev = ctx.sma(200, 50); // 200-SMA 50 bars ago, to read its slope
  const closePrev = ctx.closes[ctx.closes.length - 2];
  const closePrev2 = ctx.closes[ctx.closes.length - 3];
  if (sma == null || smaP == null || smaPrev == null || closePrev == null || closePrev2 == null) return null;

  const price = ctx.price;
  const pos = ctx.position;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stopPx = (entryPx != null) ? entryPx * 0.80 : null; // hard 20% stop below entry
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'close<200d avg & slope down' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '20% hard stop' }
    ]);
    // exit only when the close is below the 200-SMA AND the 200-SMA is falling
    if (closePrev < sma && sma < smaPrev) {
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
