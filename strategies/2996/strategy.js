/*
 * @coinsori-strategy v1
 * name: XRP 1D Donchian Trend-Follower
 * ex: binance
 * syms: XRPUSDT
 * interval: 1d
 * cash: 10000
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The ledger is clear that trend-following fails on BTC 1D but XRP
 * "trends hard and doesn't mean-revert cleanly" — it is the opposite asset type, so the
 * trend/breakout family is the right edge there. This is the classic turtle-style Donchian
 * breakout: ride sustained moves, cut losses when the move dies.
 * When it buys and sells: Buy when the close breaks above the 55-day high while the 200-day
 * average is still rising (we only chase breakouts inside a confirmed uptrend). Sell the
 * whole position when the close falls back below the 30-day low.
 * When it does NOT work: In a long sideways chop the 55-day-high breakout whipsaws and the
 * 30-day-low exit gives back most of each move. It also misses any rally that grinds up
 * slowly without fresh 55-day highs. Expect deep drawdowns in choppy bear recoveries.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  // Donchian channels from CLOSED bars (ago=1) so live and backtest see the same signal.
  const hi55 = ctx.high(55, 1);      // highest high of the last 55 closed bars
  const lo30 = ctx.low(30, 1);       // lowest low of the last 30 closed bars
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (hi55 == null || lo30 == null || sma200 == null || sma200prev == null) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;

  if (pos > 0) {
    // Ride the trend; only exit when the close breaks the 30-day low (turtle exit).
    ctx.watch([{ side: 'sell', price: lo30, trigger: 'below', note: '30-day low exit' }]);
    if (price < lo30) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Only chase breakouts inside a confirmed rising long-term trend.
  ctx.watch([{
    side: 'buy',
    price: hi55,
    trigger: 'above',
    note: '55-day high breakout',
    conds: [{ label: 'SMA200 rising', now: sma200, op: '>', ref: sma200prev, closed: true }]
  }]);

  if (uptrend && price > hi55) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
