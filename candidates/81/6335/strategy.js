/*
 * @coinsori-strategy v1
 * name: ETH SMA300 Regime Filter 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH's biggest gains happen in long uninterrupted uptrends above its 300-bar average, while its worst losses happen after price falls below that average. Riding the uptrend fully and stepping fully aside in the downtrend captures most of the bull move with a much smaller drawdown than buy-and-hold.
 * When it buys and sells: buys when the previous bar closes back above the 300-bar average (trend turns up); sells fully when the previous bar closes back below it (trend turns down). A small buffer (1% above/below) avoids flipping on noise right at the line.
 * When it does NOT work: in a long sideways market price crosses the 300-bar average repeatedly and the strategy flips between long and flat, paying fees on small losses — that is the losing regime.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  // 1% buffer each side of the 300-bar average: enter only clearly above, exit only
  // clearly below. Without it a price hovering on the line flips the position every bar.
  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300' }]);
    if (prevClose > enterLvl) {
      const qty = (ctx.cash / ctx.price) * 0.98;
      return { side: 'buy', qty };
    }
    return null;
  }

  ctx.watch([{ side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA300' }]);
  if (prevClose < exitLvl) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
