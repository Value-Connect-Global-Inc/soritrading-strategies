/*
 * @coinsori-strategy v1
 * name: BTC Asym Trend SMA100/200 + Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (SMA200 trend) rides down through crashes to a
 * 55% drawdown because the 200-day exit is slow. Exiting on a faster average
 * (SMA100) gets out of a crash earlier, while still ENTERING on the slower SMA200
 * keeps it from buying dead-cat bounces. This entry-slow / exit-fast asymmetry is
 * a classic way to cut drawdown without the whipsaw a trailing stop adds.
 * When it buys and sells: Buys when the previous close is above SMA200, sized by
 * vol-target. Sells when the previous close falls below SMA100 (earlier than the
 * 200-day). No cooldown — re-enters normally when close is back above SMA200.
 * When it does NOT work: In a sideways chop between the two averages it can exit
 * on SMA100 and re-enter on SMA200 repeatedly. It still lags sharp V-recoveries.
 * It trades some upside for lower drawdown.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma100 = ctx.sma(100, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || sma100 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma100, trigger: 'below', note: 'below SMA100' }
  ]);

  if (pos > 0) {
    if (prevClose < sma100) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
