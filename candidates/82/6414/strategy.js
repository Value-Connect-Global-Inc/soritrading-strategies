/*
 * @coinsori-strategy v1
 * name: BTC EMA200 Long/Short 4H USDM
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends hard in BOTH directions. Holding above the
 * 200-period EMA means the market is in an uptrend (go long); holding below it
 * means a downtrend (go short). Trading both sides gives a return source that
 * a long-only buy-and-hold does not have in bear markets.
 * When it buys and sells: goes long when the 4h close is above the 200 EMA and
 * short when it is below; flips to the other side when the trend reverses. A
 * wide ATR stop protects against violent gaps.
 * When it does NOT work: in tight sideways chop the price repeatedly crosses the
 * 200 EMA and whipsaws, paying fees on both sides; a sudden gap can jump through
 * the stop. Funding costs on perpetuals bleed the account in flat markets.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema200 == null || prevClose == null) return null;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const st = ctx.state;

  // Hard stop: entry price +- 3x ATR(14). Wide enough to survive normal noise.
  const atr = ctx.atr(14, 1);
  let stop = null;
  if (pos !== 0 && atr != null && ctx.entryPx != null) {
    stop = pos > 0 ? ctx.entryPx - 3 * atr : ctx.entryPx + 3 * atr;
  }

  const watchList = [];
  if (pos > 0) {
    watchList.push(
      { side: 'sell', price: ema200, trigger: 'below', note: 'Trend down flip' },
      { side: 'sell', price: stop, trigger: 'below', note: 'Hard stop' }
    );
  } else if (pos < 0) {
    watchList.push(
      { side: 'buy', price: ema200, trigger: 'above', note: 'Trend up flip' },
      { side: 'buy', price: stop, trigger: 'above', note: 'Hard stop' }
    );
  } else {
    watchList.push(
      { side: 'buy', price: ema200, trigger: 'above', note: 'Go long above 200 EMA' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'Go short below 200 EMA' }
    );
  }
  ctx.watch(watchList);

  // Manage open position: hard stop first, then trend flip.
  if (pos > 0) {
    if (stop != null && prevClose < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    if (stop != null && prevClose > stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose > ema200) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // Flat: enter on trend direction. ~0.5x notional so a wipeout needs a huge move.
  const qty = (ctx.cash / price) * 0.5;
  if (prevClose > ema200) return { side: 'buy', qty };
  if (prevClose < ema200) return { side: 'sell', qty };
  return null;
}
