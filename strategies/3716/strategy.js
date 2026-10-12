/*
 * @coinsori-strategy v1
 * name: EthDonchianBreakout
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: ETH tends to move in long, strong trends once it breaks out of a range — a
 * Donchian channel breakout catches the start of those moves early. The same 20/10 breakout that
 * held up on DOGE is applied to ETH, the asset the ledger flagged as Donchian-friendly.
 * When it buys and sells: Buys when the last closed bar closes above the highest high of the prior
 * 20 bars. Sells when the close drops below the lowest low of the prior 10 bars, or a hard 2xATR
 * stop is hit. Each position risks 2% of equity via the stop.
 * When it does NOT work: In long sideways chop the breakout is false and the stop is hit repeatedly,
 * bleeding small losses. In post-pump crashes the trailing exit gives back a large part of the gain.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  if (ctx.closes.length < 21) return null;

  // Use closed bars only: highest high of the 20 bars BEFORE the last closed bar, lowest low likewise.
  const entryHigh = ctx.high(20, 2);
  const exitLow = ctx.low(10, 2);
  if (entryHigh == null || exitLow == null) return null;
  const lastClose = ctx.closes.at(-2);
  if (lastClose == null) return null;

  const pos = ctx.position || 0;

  // Hard stop on every position: 2x ATR below entry (1d bars can gap).
  if (pos > 0 && ctx.entryPx != null) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (px < stopPx) return { side: 'sell', qty: pos };
  }

  if (pos > 0) {
    // Exit when the close breaks below the 10-bar low — the trend has reversed.
    if (lastClose < exitLow) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: exitLow, trigger: 'below', note: '10-bar low break' },
      { side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return null;
  }

  // Entry: last close above the 20-bar high. Risk 2% of equity per trade with the 2xATR stop.
  if (lastClose > entryHigh) {
    const risk = 0.02 * ctx.cash;
    const stopDist = 2 * atr;
    const qty = risk / stopDist;
    if (qty <= 0) return null;
    ctx.watch([
      { side: 'sell', price: exitLow, trigger: 'below', note: '10-bar low break' },
      { side: 'sell', price: px - 2 * atr, trigger: 'below', note: '2xATR stop' }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '20-bar high break' }]);
  return null;
}
