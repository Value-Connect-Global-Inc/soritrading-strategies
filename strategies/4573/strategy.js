/*
 * @coinsori-strategy v1
 * name: SMA200 Trend-Following Basket v2 (slope filter)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the 200-day moving average is the classic long-term trend
 * line. When price is above it AND the average itself is rising, the asset is
 * in a real bull trend; when price crosses below it, the trend has broken.
 * Pure technical rule — no sentiment index, no macro data. The v2 addition is
 * a slope filter: only enter when the 200-day average is also rising, which
 * filters out the whipsaw of sideways markets where a flat average gets
 * crossed back and forth.
 * When it buys and sells: on each asset, buy when the daily close crosses ABOVE
 * its 200-day average (closed bars) AND that average is rising (higher than it
 * was 20 bars ago). Sell when the close crosses BELOW it, or if price drops
 * 30% below entry (hard stop).
 * When it does NOT work: in a long sideways market the price still whipsaws
 * around the 200-day average and the strategy alternates small wins and losses
 * (many fees). It always buys late into a rally and sells late into a decline,
 * giving back part of every turn. It has no short side — it just sits in cash
 * during the bear.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar SMA200 for the last two closed bars to detect the crossover.
  const s1 = ctx.sma(200, 1); // previous closed bar
  const s2 = ctx.sma(200, 2); // the bar before that
  // Slope check: the 200-day average 20 bars ago (closed), to see if it is rising.
  const sSlope = ctx.sma(200, 21);
  if (s1 == null || s2 == null || sSlope == null) return null;

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

  // Trend start: cross above 200-day average AND the average is rising.
  // The slope filter is the classic 'trend is your friend' rule — entering on a
  // flat/falling average is how sideways markets whipsaw you.
  if (c1 > s1 && c2 <= s2 && s1 > sSlope) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: s1,
    trigger: 'above',
    note: 'enter: close > SMA200 & SMA200 rising',
    conds: [{ label: 'SMA200 rising', ok: s1 > sSlope }]
  }]);
  return null;
}
