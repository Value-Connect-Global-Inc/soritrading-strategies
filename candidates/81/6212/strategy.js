/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends most of a bull market above its 200-bar
 * average and most of a bear below it, so closing price vs SMA200 is a simple
 * regime switch. A wide ATR trailing stop rides the trend further and cuts
 * crash drawdowns without whipsawing on small pullbacks.
 * When it buys and sells: buys when the last closed 4h bar closes above
 * SMA200; sells when it closes back below SMA200 or drops 4xATR below its
 * highest high since entry.
 * When it does NOT work: long sideways chop crosses the SMA200 line
 * repeatedly (fee bleed), and a deep bull pullback can stop it out then
 * re-enter it slightly lower.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma == null) return null;

  if (ctx.position <= 0) {
    ctx.state.entryHigh = 0; // fresh trailing anchor for a new position
    ctx.watch([
      { side: 'buy', price: sma, trigger: 'above', note: 'close above SMA200' }
    ]);
    if (prevClose > sma) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    return null;
  }

  // chandelier trailing stop from the highest CLOSED high since entry
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const closedHigh = ctx.highs.at(-2);
  let hh = ctx.state.entryHigh || 0;
  if (closedHigh > hh) hh = closedHigh;
  ctx.state.entryHigh = hh;
  const stop = hh - 4 * atr; // 4xATR: wide enough to ignore normal bull pullbacks

  ctx.watch([
    { side: 'sell', price: sma, trigger: 'below', note: 'close below SMA200' },
    { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop (4 ATR)' }
  ]);

  const closedLow = ctx.lows.at(-2);
  if (prevClose < sma || closedLow <= stop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
