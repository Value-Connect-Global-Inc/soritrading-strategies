/*
 * @coinsori-strategy v1
 * name: BTC 1h Trend Rider with ATR Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Bet: when price holds above its 200-period average the market is in an uptrend and
 * tends to keep making higher highs, so riding that trend with a hard stop captures the
 * move while capping each loss.
 * Buys when price closes above the 50-period average while the 200-period trend filter
 * is up; sells when price closes back below the 50-period average or when the 2.5xATR
 * stop is hit.
 * Does NOT work in sideways chop (it whipsaws between the two averages) and it steps
 * aside in downtrends, so it never profits from falling markets.
 */
function onUpdate(ctx) {
  const close1 = ctx.closes.at(-2);            // last closed bar
  const sma200 = ctx.sma(200, 1);
  const sma50  = ctx.sma(50, 1);
  const atr    = ctx.atr(14, 1);
  if (close1 == null || sma200 == null || sma50 == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;

  // --- exit logic (before entries) ---
  if (ctx.position > 0) {
    const stopPx = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
    const watch = [
      { side: 'sell', price: sma50, trigger: 'below', note: 'trend break below SMA50' }
    ];
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: '2.5xATR stop' });
    ctx.watch(watch);

    if (close1 < sma50) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stopPx != null && price < stopPx) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // --- entry logic (flat only) ---
  const uptrend  = close1 > sma200;
  const breakout = close1 > sma50;
  const entryWatch = [{
    side: 'buy', price: sma50, trigger: 'above', note: 'breakout above SMA50',
    conds: [ { label: 'uptrend SMA200', ok: uptrend } ]
  }];

  if (uptrend && breakout) {
    // risk 1% of equity on the 2.5xATR stop so one loss cannot hurt the account much
    const riskAmt = ctx.cash * 0.01;
    const stopDist = 2.5 * atr;
    let qty = riskAmt / stopDist;
    const maxQty = (ctx.cash / price) * 0.99;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) { ctx.watch([]); return null; }
    ctx.watch(entryWatch);
    return { side: 'buy', qty: qty };
  }

  ctx.watch(entryWatch);
  return null;
}
