/*
 * @coinsori-strategy v1
 * name: SOL 4H EMA50/200 Trend + SMA200 Crash Filter
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The plain EMA50/200 trend already beat buy-and-hold on BTC 4h in every
 * tested window. SOL is a higher-beta asset, so a trend filter on it should ride crypto's
 * strongest rallies and step aside in the crashes — similar return to holding with a much
 * smaller drawdown.
 * When it buys and sells: Hold a full position while the 50-EMA is above the 200-EMA and price
 * is above the 200-SMA (confirmed uptrend). Sell everything when either breaks — the SMA200
 * gate is the crash filter. A wide -35% disaster stop is tail insurance only.
 * When it does NOT work: In a long sideways/choppy period the filter whipsaws and pays fees
 * while holding does nothing; in a violent V-shaped crash the 4h close confirms late, so the
 * disaster stop may be the actual exit. It also lags a straight-line melt-up that never pulls
 * back to its averages.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || sma200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = ema50 > ema200 && prevClose > sma200;

  // Entry: we buy when price closes back above the 200-SMA inside an EMA50>EMA200 uptrend.
  const entryWatch = [{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'close above SMA200 in uptrend',
    conds: [{ label: 'EMA50>EMA200', ok: ema50 > ema200 }]
  }];

  if (ctx.position > 0) {
    // Disaster stop: -35% from entry, tail insurance only (SOL can gap through the filter in a crash).
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.65 : null;
    // Trend exit: whichever of the two trend lines is lower breaks first.
    const exitBelow = Math.min(ema50, sma200);
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken (EMA50 or SMA200)' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -35%' }] : [])
    ]);
    if (stop != null && prevClose < stop) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (prevClose < exitBelow) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // Entry: full position when the trend filter turns positive (closed bars only).
  if (uptrend) {
    ctx.watch(entryWatch);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  ctx.watch(entryWatch);
  return null;
}
