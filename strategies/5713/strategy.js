/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + Donchian Trail 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The pure 200-day trend (strategy 5710) is this job's best
 * result (+134% vs +38% buy-and-hold) but gives back a 33% drawdown before the
 * slow 200-day exit triggers. A tight 3x-ATR chandelier stop failed (whipsaw).
 * This version uses a looser Donchian trailing exit — we sell when the close
 * falls below the lowest low of the last 20 days. That is a classic "the trend
 * has broken" signal that is loose enough to survive normal pullbacks but
 * tight enough to lock in gains before a real top forms. When stopped out we
 * simply wait for the next SMA200 re-entry signal.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average. Exits when the close falls below the lowest low of the last 20 days
 * (trailing stop) OR below the 200-day average, whichever happens first.
 * When it does NOT work: In a choppy bull, a 20-day low can still be hit on a
 * normal shakeout and stop us out early, missing part of the move. In a long
 * sideways range it whipsaws across the 200-day line. It lags sharp V-shaped
 * recoveries from deep bears.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const low20 = ctx.low(20, 1); // lowest low of last 20 bars (trailing stop level)
  if (sma200 == null || low20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'close below SMA200' },
      { side: 'sell', price: low20, trigger: 'below', note: '20-day low trail' }
    ]);
    if (prevClose < sma200 || prevClose < low20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'close above SMA200' }]);
  if (prevClose > sma200) {
    const qty = (0.99 * ctx.cash) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
