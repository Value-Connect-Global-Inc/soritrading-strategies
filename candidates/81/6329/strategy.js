/*
 * @coinsori-strategy v1
 * name: BTC SMA100 Regime Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's biggest gains happen in long uninterrupted uptrends above its average, while its worst losses happen after price falls below that average. A faster 100-bar average steps out of crashes sooner than a 200-bar one, trading a little more whipsaw for a smaller drawdown.
 * When it buys and sells: buys when the previous bar closes back above the 100-bar average (trend turns up); sells fully when the previous bar closes back below it (trend turns down). A small buffer (1% above/below) avoids flipping on noise right at the line.
 * When it does NOT work: in a long sideways market price crosses the average repeatedly and the strategy flips between long and flat, paying fees on small losses — that is the losing regime.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma = ctx.sma(100, 1);
  if (sma == null) return null;

  const enterLvl = sma * 1.01; // enter only clearly above the average
  const exitLvl = sma * 0.99;  // exit only clearly below it

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA' }]);
    if (prevClose > enterLvl) {
      const qty = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty };
    }
    return null;
  }

  ctx.watch([{ side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA' }]);
  if (prevClose < exitLvl) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
