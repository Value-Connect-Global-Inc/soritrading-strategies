/*
 * @coinsori-strategy v1
 * name: BTC Regime Filter 33D 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC spends most of its time trending. A slow 33-day (200-bar) SMA separates
 * bull regimes (price above) from bear regimes (price below). Being LONG while above and FLAT while
 * below captures most of the bull moves while stepping aside for the crashes that make buy-and-hold
 * drawdowns so deep. 33 days is the middle ground between the 20d exit that whipsawed (too twitchy)
 * and the 50d exit that rode crashes down ~12% (too slow).
 * When it buys and sells: buys when price closes above the 200-bar SMA; sells when price closes
 * below it.
 * When it does NOT work: a sideways chop that repeatedly crosses the 200-bar SMA whipsaws it and
 * the fees add up. It also gives back the first ~10% of every crash before the SMA is crossed.
 */
function onUpdate(ctx) {
  const REGIME_N = 200;  // ~33 days at 4h: slow enough to avoid chop, fast enough to cut crashes

  const ma = ctx.sma(REGIME_N, 1);
  if (ma == null) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);  // last CLOSED bar (identical backtest/live)
  const price = ctx.price;

  if (ctx.position > 0) {
    if (prevClose < ma) {
      ctx.watch([{ side: 'sell', price: ma, trigger: 'below', note: 'below 33d regime MA' }]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: ma, trigger: 'below', note: 'below 33d regime MA' }]);
    return null;
  }

  if (prevClose > ma) {
    ctx.watch([{ side: 'buy', price: ma, trigger: 'above', note: 'above 33d regime MA' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: ma, trigger: 'above', note: 'above 33d regime MA' }]);
  return null;
}
