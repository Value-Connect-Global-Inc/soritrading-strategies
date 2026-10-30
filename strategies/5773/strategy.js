/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed index measures crypto-native sentiment and swings into
 * extreme fear more often than the stock-market VIX. Extreme fear during an uptrend is a dip to buy.
 * But buying while still falling catches knives, so this version waits for a reversal confirmation
 * (price back above the 50-bar average) and exits with a trailing stop instead of waiting for greed.
 * When it buys and sells: Buy when the index is below 30 (extreme fear), the 200-bar average is
 * rising, AND price has already bounced back above the 50-bar average (dip reversed). Sell when
 * price falls back below the 50-bar average (trend broken) or on a 12% hard stop.
 * When it does NOT work: In a bear market the rising-trend gate keeps it out (good), but a long
 * sideways chop produces false bounces and whipsaws, and a fast crash re-tests the lows and stops
 * it out. It lags buy-and-hold in a relentless bull with no fear dips.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const fg = ctx.data('fear_greed'); // crypto-native sentiment, 0-100, daily
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop on every position
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'trail exit SMA50' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    if (price < sma50) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (!trendUp) return null;
  const fear = (fg != null && fg < 30); // extreme fear = contrarian candidate
  const bounced = price > sma50; // dip already reversing, not still falling
  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'FG<30 + bounce', conds: [
    { label: 'FG index', now: fg, op: '<', ref: 30, closed: true },
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (fear && bounced) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
