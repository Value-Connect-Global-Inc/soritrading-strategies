/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index (0=extreme fear, 100=extreme greed)
 * measures crowd emotion. Crowds overshoot, so extreme fear often marks local
 * bottoms and extreme greed marks tops. This bets on that overshoot — a
 * sentiment-contrarian family, different from the price-only trend champion.
 * When it buys and sells: Buys when the index is very fearful (<=25) AND the
 * long-term trend is still up (close above the 200-day average) so we are not
 * catching a knife in a bear market. Sells when the index turns very greedy
 * (>=75), or immediately if price falls 25% below entry (disaster stop).
 * When it does NOT work: In a persistent bear market the 200-day filter keeps
 * it out (good) but it also misses the recovery. In a strong bull it exits too
 * early on greed readings and re-enters on every fear dip. Sentiment data only
 * starts in 2018, so earlier cycles (2013/2017) are never tested.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  if (atr20 == null || closes.length < 210) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    const disaster = (entryPx != null) ? entryPx * 0.75 : null; // 25% below entry
    const watch = [];
    if (disaster != null) watch.push({ side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' });
    if (watch.length > 0) ctx.watch(watch);
    if (fg >= 75) return { side: 'sell', qty: pos, reduceOnly: true }; // extreme greed = exit
    if (disaster != null && price <= disaster) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (fg <= 25 && prevClose > sma200) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct); // vol-target: 3% daily ATR = full position
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
