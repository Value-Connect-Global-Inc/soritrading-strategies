/*
 * @coinsori-strategy v1
 * name: ETH Trend Regime 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In strong trends an asset keeps making progress above its long moving
 *   average; stepping aside when that trend breaks avoids the deep drawdowns that buy-and-hold
 *   suffers while still capturing most of the upside.
 * When it buys and sells: It buys when the 50-period EMA is above the 200-period EMA (regime
 *   is up) and price closes above the 50 EMA. It sells (goes to cash) when price closes below
 *   the 50 EMA or hits a 3x ATR hard stop, so it is never long in a broken trend.
 * When it does NOT work: In a choppy sideways market price repeatedly crosses the 50 EMA and
 *   causes whipsaws and fees; and because it is long-only, a strong rally that starts right
 *   after a brief dip is partially missed.
 */

function onUpdate(ctx) {
  const emaFast = ctx.ema(50, 1);
  const emaSlow = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const prevPrice = ctx.closes.at(-2);
  if (emaFast == null || emaSlow == null || atr == null || prevPrice == null) return null;

  const inUptrend = emaFast > emaSlow;

  if (ctx.position > 0) {
    // Hard stop: 3x ATR below entry protects against a gap through the EMA exit.
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    const watchList = [{ side: 'sell', price: emaFast, trigger: 'below', note: 'close below EMA50 exit' }];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: '3xATR hard stop' });
    ctx.watch(watchList);

    if (prevPrice < emaFast || (stop != null && prevPrice < stop)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: emaFast, trigger: 'above', note: 'close above EMA50 entry', conds: [{ label: 'EMA50>EMA200', ok: inUptrend, closed: true }] }]);

  if (inUptrend && prevPrice > emaFast) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
