/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Vol-Target Size + Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 200-day trend with volatility-scaled sizing (5714) is
 * this job's best result, but it has no hard stop — in a crash it rides down
 * until the slow 200-day exit fires. This version adds one protective rule:
 * if the price ever falls 25% below the entry price, we exit immediately.
 * 25% is about 8 daily ATRs, so it only fires in a genuine crash, not in
 * normal day-to-day volatility. It keeps the same entries and the same
 * volatility-scaled position size; the stop only caps the worst-case loss.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average, sized by min(1, 3% / ATR(20)-as-percent). Sells when the close
 * falls below the 200-day average OR the price drops 25% below the entry
 * price (hard stop). No other exits.
 * When it does NOT work: In a long sideways range it whipsaws across the
 * 200-day line. The hard stop can lock in a loss right before a sharp
 * V-shaped recovery. It lags sharp rallies because it is under-invested in
 * high-volatility bull spikes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' }
  ]);

  if (pos > 0) {
    // hard stop: 25% below entry = ~8 daily ATRs, only fires in real crashes
    if (entryPx != null && price <= entryPx * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (prevClose < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // allocation engine must be healthy before opening new positions (reduce-only edge otherwise)
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    // vol-target: 3% daily ATR = full size, scale down linearly as vol rises
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
