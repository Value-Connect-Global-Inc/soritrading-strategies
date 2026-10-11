/*
 * @coinsori-strategy v1
 * name: ETH Trend Ride ATR Trailing 4H
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH on 4H builds strong directional runs. A simple trend
 * follower with an ATR trailing stop rides most of each run and cuts losers
 * fast. Trend following is a different family from the mean-reversion ideas
 * that all failed on BTC 1D in earlier cycles.
 * When it buys and sells: Buys when the 50-EMA is rising and price is above it.
 * Sells when price drops more than 3x ATR(14) below the highest close since entry.
 * When it does NOT work: In a choppy sideways range the trailing stop gets hit
 * repeatedly and it bleeds small losses. Sharp V-reversals gap through the stop.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Trend gate on closed bars (1 and 2) so live == backtest.
  const ema = ctx.ema(50, 1);
  const emaPrev = ctx.ema(50, 2);
  if (ema == null || emaPrev == null) return null;
  const emaRising = ema > emaPrev;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const st = ctx.state;
  if (pos > 0) {
    // Track the highest close since entry for the trailing stop.
    let hi = st.hi || price;
    if (price > hi) { hi = price; st.hi = hi; }
    const stop = hi - atr * 3;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' }]);
    if (price < stop) {
      st.hi = 0;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: ema,
    trigger: 'above',
    note: '50 EMA reclaim',
    conds: [{ label: 'EMA50 rising', now: ema, op: '>', ref: emaPrev, closed: true }]
  }]);

  if (emaRising && price > ema) {
    st.hi = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
