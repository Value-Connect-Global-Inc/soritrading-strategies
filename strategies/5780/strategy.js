/*
 * @coinsori-strategy v1
 * name: BTC Turtle TrendFilter 1D
 * interval: 1d
 * ex: binance
 * syms: BTC/USDT
 * cash: 10000
 *
 * Why this strategy: A plain turtle fails in bear markets because short-side breakouts whipsaw. This
 * version only takes LONG breakouts when the 200-day trend is already up — so a fresh 55-day high in
 * an uptrend is a real continuation, not a bear rally. Full investment fixes the under-sizing that
 * made the earlier turtle lag buy-and-hold. Exits are wide (20-day low) so normal noise is not a signal.
 * When it buys and sells: Buy with ~95% of cash when price closes above the 55-day high AND the
 * 200-day average is rising. Sell all when price closes below the 20-day low. No position in bear
 * markets (trend gate off), so it sits out downtrends instead of getting chopped.
 * When it does NOT work: In a long sideways market, 55-day breakouts in a barely-rising trend fail
 * repeatedly (each is a full-size loss). It lags buy-and-hold in a smooth relentless bull because it
 * exits pullbacks below the 20-day low and re-enters on a fresh high. It does not short.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const hi55 = ctx.high(55, 1); // highest high of last 55 CLOSED days
  const lo20 = ctx.low(20, 1);  // lowest low of last 20 CLOSED days
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (hi55 == null || lo20 == null || sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: lo20, trigger: 'below', note: '20-day low exit' }]);
    if (price < lo20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day breakout in uptrend', conds: [
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (trendUp && price > hi55) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
