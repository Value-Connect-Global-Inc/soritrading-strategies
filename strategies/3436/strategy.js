/*
 * @coinsori-strategy v1
 * name: BTC Crash Detector 1D
 * ex: binance
 * syms: BTC
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto crashes are fast and recoveries are slow. We hold BTC during normal times and flee on EITHER of two distinct danger signals: a sharp 8% drop from the recent 20-day peak (fast crash), or a close below the 200-day trend line (slow grinding bear). Dodging both kinds of bear phases is what protects the account.
 * When it buys and sells: Buys when the daily close breaks above the prior 20-day high. Sells when the close falls 8% below the 20-day peak OR closes below the 200-day average.
 * When it does NOT work: Choppy sideways markets around the 20-day high produce repeated small whipsaw losses. In a long pure bull run with no bear phase, buy-and-hold earns more because we sit out the pullbacks.
 */
function onUpdate(ctx) {
  if (ctx.closes.length < 42) return null;
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  // highest CLOSED bar close over the 20 bars BEFORE the entry bar (ago 2..21)
  let peak = -Infinity;
  for (let k = 2; k <= 21; k++) {
    const c = ctx.closes.at(-1 - k);
    if (c != null && c > peak) peak = c;
  }
  if (peak === -Infinity) return null;

  // --- exits: fast crash (8% off peak) OR slow grind (below 200d line) ---
  if (ctx.position > 0) {
    if (prevClose < peak * 0.92 || prevClose < sma200) {
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
