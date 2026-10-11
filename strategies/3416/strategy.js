/*
 * @coinsori-strategy v1
 * name: BTC Vol Squeeze Breakout 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: after a period of very low volatility (a squeeze), crypto
 * tends to break out hard in one direction. We buy the upside expansion and
 * ride it while volatility stays high, with a hard stop — but only inside an
 * uptrend so we do not buy bear-market false breakouts.
 * When it buys and sells: buy when a closed bar closes above the upper Bollinger
 * band AND band width was below its 50-bar average (a real squeeze) AND price is
 * above its 200-bar average. Sell when a closed bar closes back below the middle
 * band or the hard 2.5-ATR stop is hit.
 * When it does NOT work: in a low-volatility range that grinds sideways without
 * expanding, and in a downside squeeze (price breaks lower band instead). The
 * trend filter keeps it out of bear markets entirely, so it is flat there.
 * Long-only.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 220) return null;
  const prevClose = closes[n - 2];
  if (prevClose == null) return null;

  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'below', note: 'mean exit' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }
    ]);
    if (prevClose < bb.mid || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const bw = (bb.upper - bb.lower) / bb.mid;
  let bwSum = 0, bwCnt = 0;
  for (let a = 2; a <= 51; a++) {
    const b = ctx.bb(20, 2, a);
    if (b == null) continue;
    bwSum += (b.upper - b.lower) / b.mid;
    bwCnt++;
  }
  if (bwCnt < 30) return null;
  const bwAvg = bwSum / bwCnt;

  const breakout = prevClose > bb.upper;
  // trend filter: breakouts below the 200-bar average are false more often
  if (breakout && bw < bwAvg && prevClose > sma200) {
    ctx.watch([{ side: 'sell', price: bb.mid, trigger: 'below', note: 'mean exit' },
               { side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * 0.5 };
  }
  return null;
}
