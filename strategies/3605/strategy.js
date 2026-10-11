/*
 * @coinsori-strategy v1
 * name: Squeeze Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Big crypto trends often start from a period of quiet,
 * compressed volatility (a "squeeze") followed by a burst. Buying the first
 * breakout out of a tight range skips the failed breakouts that come after big
 * runs. Bet: volatility compression precedes expansion.
 * When it buys and sells: buys when the Bollinger band width is in the bottom
 * 20% of its last 100 bars (volatility squeezed) AND the close breaks above the
 * upper band. Sells on a 20-bar channel low or a 2.5x ATR hard stop.
 * When it does NOT work: in a long quiet range the squeeze can fire and the
 * breakout immediately fails (stop-outs); in a runaway bull with no pullback the
 * bands stay wide so it never enters and misses the move.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);   // Bollinger bands on the last CLOSED bar
  const atr = ctx.atr(14, 1);
  const ll20 = ctx.low(20, 2);   // lowest low of the 20 bars BEFORE the last close
  if (bb == null || atr == null || ll20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const bbw = (bb.upper - bb.lower) / bb.mid; // relative band width = volatility

  // rolling 100-bar history of band width, kept in state (ctx has no rolling percentile)
  const arr = ctx.state.bbwArr || (ctx.state.bbwArr = []);
  arr.push(bbw);
  if (arr.length > 100) arr.shift();
  if (arr.length < 100) return null;
  const sorted = arr.slice().sort((a, b) => a - b);
  const p20 = sorted[19]; // 20th percentile of recent volatility

  if (ctx.position > 0) {
    // hard stop: 2.5x ATR below entry — caps the loss on any single trade
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (ctx.price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  // entry: volatility compressed to the bottom 20% AND a close above the upper band (breakout)
  if (bbw > p20) return null;
  if (prevClose <= bb.upper) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / ctx.price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
