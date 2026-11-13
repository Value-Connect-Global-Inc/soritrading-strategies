/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend Pullback Long
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * In a clear uptrend (price above the 200-bar average), pullbacks toward the 50-bar
 * average usually resume the trend. We only buy these pullbacks, never in a downtrend.
 * Buy when price dips to the 50-bar average and closes back above it while the 200-bar
 * trend is up. Exit on a hard ATR stop, a close back below the 50-bar, or a trend flip.
 * Loses in long choppy ranges and in sustained downtrends (long-only); crashes can gap
 * through the stop.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema50 == null || atr == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  if (prevClose == null || prevPrevClose == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  const bull = prevClose > ema200;

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    const watches = [];
    if (stopPx != null) watches.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR stop' });
    watches.push({ side: 'sell', price: ema50, trigger: 'below', note: '50 EMA fail' });
    watches.push({ side: 'sell', price: ema200, trigger: 'below', note: 'trend flip' });
    ctx.watch(watches);

    if (stopPx != null && price <= stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < ema50 || prevClose < ema200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  const crossedUp = prevPrevClose <= ema50 && prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: '50 EMA pullback recov',
               conds: [{ label: '200 EMA trend up', ok: bull }] }]);
  if (!bull || !crossedUp) return null;

  const riskCash = ctx.cash * 0.02;   // risk 2% of cash per trade so a stop-out never hurts much
  const riskPerCoin = 2.5 * atr;
  let qty = riskCash / riskPerCoin;
  const maxQty = ctx.cash / price * 0.99;
  if (qty > maxQty) qty = maxQty;
  if (!(qty > 0)) return null;
  return { side: 'buy', qty };
}
