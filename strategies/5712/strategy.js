/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Chandelier Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure 200-day trend (strategy 5710) is this job's best
 * result (+134% vs +38% buy-and-hold on the recent window) but its weakness is
 * the ride-down: once price stops making highs it just sits there until the
 * close finally falls below the 200-day average, giving back a 33% drawdown.
 * This version keeps the same entry but adds a chandelier trailing stop so we
 * exit when price gives back 3x the recent daily volatility from its best
 * level — capturing more of the top while still letting strong trends run.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average. Exits when the close falls below the 200-day average OR when the
 * close falls more than 3 x ATR(14) below the highest close since entry
 * (whichever happens first).
 * When it does NOT work: In a choppy bull, normal pullbacks can exceed 3x ATR
 * and shake us out early, missing the rest of the move. In a long sideways
 * range it still whipsaws across the 200-day line. It lags sharp V-shaped
 * recoveries from deep bears.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const st = ctx.state || {};

  if (pos > 0) {
    // track the highest close since entry (survives restart via ctx.state)
    const hi = (st.hi != null && st.hi > prevClose) ? st.hi : prevClose;
    ctx.state = { hi };
    const stop = hi - 3 * atr; // chandelier: give back 3x daily vol before exiting
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: 'chandelier stop' }
    ]);
    if (prevClose < sma200 || prevClose < stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state = {};
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' }]);
  if (prevClose > sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
