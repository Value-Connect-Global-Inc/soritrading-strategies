/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Regime + Crash Stop 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's biggest gains happen in long uninterrupted uptrends above its 200-bar average, while its worst losses happen in sudden crashes. Riding the uptrend fully, stepping aside below the average, and cutting any position that falls 25% from its peak close avoids both the worst drawdowns and the whipsaw of a faster filter.
 * When it buys and sells: buys when the previous bar closes back above the 200-bar average; sells fully when the previous bar closes below it, OR when the close has fallen 25% from the highest close since entry (crash stop — whichever comes first).
 * When it does NOT work: in a long sideways market price crosses the average repeatedly and the strategy flips long/flat, paying fees on small losses — that is the losing regime.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const enterLvl = sma200 * 1.01; // enter only clearly above the average
  const exitLvl = sma200 * 0.99;  // exit only clearly below it

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA200' }]);
    if (prevClose > enterLvl) {
      ctx.state.peak = prevClose; // anchor the crash stop at the entry close
      const qty = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty };
    }
    return null;
  }

  // Crash stop: a bull's normal pullbacks are smaller than 25%, but BTC's crashes
  // (2021, 2022) were 40-50% — this cuts them before the slow average catches up.
  const peak = Math.max(ctx.state.peak || prevClose, prevClose);
  ctx.state.peak = peak;
  const crashStop = peak * 0.75;

  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA200' },
    { side: 'sell', price: crashStop, trigger: 'below', note: '25% crash stop' }
  ]);
  if (prevClose < exitLvl || prevClose < crashStop) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
