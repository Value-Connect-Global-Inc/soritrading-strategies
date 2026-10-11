/*
 * @coinsori-strategy v1
 * name: BTC Crash Detector 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto crashes are fast and recoveries are slow. So instead of trying to predict direction, we hold BTC during normal times and only flee when price drops sharply from its recent peak — dodging the worst of each crash while missing only a few days of the recovery.
 * When it buys and sells: Buys when the daily close makes a new 20-day high (momentum confirmed). Sells when the close falls 8% below the recent 20-day high close (crash detected).
 * When it does NOT work: A slow grinding bear market with no sharp drops — price erodes below the 20-day peak without ever triggering the 8% exit, so we hold through the whole decline. Also, choppy whipsaw markets around the 20-day high produce repeated small losses.
 */
function onUpdate(ctx) {
  if (ctx.closes.length < 42) return null;  // need history for the 20-day high
  const prevClose = ctx.closes.at(-2);
  // highest CLOSED bar close over the 20 bars BEFORE the entry bar (ago 2..21)
  let peak = -Infinity;
  for (let k = 2; k <= 21; k++) {
    const c = ctx.closes.at(-1 - k);
    if (c != null && c > peak) peak = c;
  }
  if (peak === -Infinity) return null;

  // --- exits: crash detected when close falls 8% below recent peak ---
  if (ctx.position > 0) {
    if (prevClose < peak * 0.92) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- entry: close breaks above the prior 20-day high ---
  if (prevClose > peak) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
