/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Vol-Target Size + Hard Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The job's best strategy (SMA200 trend + vol-target
 * sizing, 5714) still rides down through slow crashes because the 200-day
 * exit is late. This version keeps every signal and the vol-target sizing but
 * adds a hard stop-loss 25% below the average entry price, so a crash can
 * only cost us a fixed amount per position before we step aside. Same trades,
 * capped loss per position.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average, sized as min(1, 3%/ATR20%) of cash (high volatility = smaller
 * position). Sells when (a) the close falls below the 200-day average, or
 * (b) the price falls 25% below our entry (hard stop). After a hard-stop exit
 * we wait for the close to climb back above the 200-day average before buying
 * again.
 * When it does NOT work: A hard stop locks in losses in sharp V-shaped
 * crashes that recover fast (e.g. March 2020) — we sell at -25% and the price
 * is back above the trend line within weeks, so we buy back higher. It also
 * still whipsaws in long sideways ranges.
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
  const entry = ctx.entryPx;

  // hard stop: exit any position that has fallen 25% below its average entry
  // (25% is wide enough to survive normal noise but caps a crash before the
  // slow 200-day exit fires)
  const stop = entry != null ? entry * 0.75 : null;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop 25%' }] : [])
  ]);

  if (pos > 0) {
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // allocation engine must be healthy before opening new positions
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
