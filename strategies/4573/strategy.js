/*
 * @coinsori-strategy v1
 * name: SMA200 Trend-Following Basket v1
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the 200-day moving average is the classic long-term trend
 * line. When price is above it, the asset is in a bull trend; when price
 * crosses below it, the trend has broken. This is a pure technical rule — no
 * sentiment index, no macro data — that has survived across decades and
 * markets because trends persist. It rides the full bull and steps aside
 * during the bear on a 4-coin basket so no single asset decides the account.
 * When it buys and sells: on each asset, buy when the daily close crosses ABOVE
 * its 200-day average (closed bars). Sell when the close crosses BELOW it, or
 * if price drops 30% below entry (hard stop in case the trend break is violent).
 * When it does NOT work: in a long sideways market the price whipsaws around
 * the 200-day average and the strategy alternates small wins and losses (many
 * fees). It always buys late into a rally (after the trend is confirmed) and
 * sells late into a decline, so it gives back part of every turn. It has no
 * short side — it just sits in cash during the bear.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar SMA200 for the last two closed bars to detect the crossover.
  const s1 = ctx.sma(200, 1); // previous closed bar
  const s2 = ctx.sma(200, 2); // the bar before that
  if (s1 == null || s2 == null) return null;

  // Previous two CLOSED closes (ago=1/2 reads closed bars; identical live/paper/backtest).
  const c1 = ctx.closes.at(-2);
  const c2 = ctx.closes.at(-3);
  if (c1 == null || c2 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // Hard stop: caps the loss on any single position.
    const entry = ctx.entryPx;
    if (entry != null && price <= entry * 0.70) return { side: 'sell', qty: pos };
    // Trend break: cross below 200-day average -> exit.
    if (c1 < s1 && c2 >= s2) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: entry != null ? entry * 0.70 : price, trigger: 'below', note: 'stop: -30%' },
      { side: 'sell', price: s1, trigger: 'below', note: 'trend break: close < SMA200' }
    ]);
    return null;
  }

  // Trend start: cross above 200-day average -> enter.
  if (c1 > s1 && c2 <= s2) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: s1,
    trigger: 'above',
    note: 'enter: close crosses above SMA200'
  }]);
  return null;
}
