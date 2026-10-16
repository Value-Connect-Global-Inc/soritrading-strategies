/*
 * @coinsori-strategy v1
 * name: GoldenCross Multi-Asset Basket v1
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: long-term trends in crypto persist for months once the
 * 50-day average is above the 200-day average (the classic "golden cross").
 * This is a pure price-trend family — it reacts to the market itself, not to
 * a sentiment index, so it is a different bet from the Fear&Greed champion.
 * When it buys and sells: buy when the 50-day average crosses above the
 * 200-day average (both read from closed bars); hold while the trend is up;
 * sell when the 50-day average crosses back below the 200-day average, or if
 * price falls 30% below entry (hard stop).
 * When it does NOT work: in a long sideways market the two averages cross back
 * and forth and each cross costs a small loss (whipsaw). It also re-enters
 * late after a crash bottom, missing the first sharp rally of a new bull.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma50p = ctx.sma(50, 2);
  const sma200p = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma50p == null || sma200p == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: backstop for crashes faster than the death cross can react
      // to. 30% because healthy pullbacks in an uptrend can reach 20-25%.
      if (price <= entry * 0.70) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.70, trigger: 'below', note: 'stop: -30%' }]);
    }
    // Death cross: trend broken, get out.
    if (sma50p >= sma200p && sma50 < sma200) return { side: 'sell', qty: pos };
    return null;
  }

  // Golden cross: fresh trend start, enter at fixed 95% sizing (same
  // philosophy as the proven champion).
  if (sma50p <= sma200p && sma50 > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'golden cross entry',
    conds: [{ label: 'SMA50 vs SMA200', now: sma50, op: '>', ref: sma200, closed: true }]
  }]);
  return null;
}
