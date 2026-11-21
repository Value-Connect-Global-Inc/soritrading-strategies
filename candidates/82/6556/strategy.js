/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Regime Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC moves in long multi-month trends. A slow 200-bar (about 33 days)
 * moving average separates bull regimes from bear regimes without the churn of fast signals.
 * Staying long the whole time price is above it captures most of a bull run, while stepping
 * aside when price closes below it avoids the biggest crashes. A 2% hysteresis band creates a
 * dead zone around the SMA so dead-cat bounces in a bear market do not trigger re-entry and
 * small noise does not churn the position. The goal is a return close to holding with a
 * clearly smaller drawdown.
 * When it buys and sells: Buy when the last closed bar closes more than 2% above the 200-bar
 * SMA; sell everything when it closes more than 2% below the 200-bar SMA. Between those two
 * lines it does nothing (holds or stays flat).
 * When it does NOT work: In a long flat sideways range the price still crosses the band edges
 * and each crossing costs fees (whipsaw). It lags sharp V-shaped recoveries and re-enters
 * late after a crash.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // 2% hysteresis band: exit only well below the SMA, enter only well above it
  const band = 0.02;
  const pos = ctx.position || 0;

  if (pos > 0) {
    const exitLvl = sma200 * (1 - band);
    ctx.watch([{ side: 'sell', price: exitLvl, trigger: 'below', note: 'SMA200 -2% breakdown' }]);
    if (prevClose < exitLvl) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const enterLvl = sma200 * (1 + band);
  ctx.watch([{ side: 'buy', price: enterLvl, trigger: 'above', note: 'SMA200 +2% uptrend' }]);
  if (prevClose > enterLvl) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
