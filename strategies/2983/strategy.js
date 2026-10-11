/*
 * @coinsori-strategy v1
 * name: BTC 1D Donchian Breakout Trend Rider
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic Turtle-style trend following — enter on a Donchian channel
 * breakout and ride the trend with a wide ATR trailing stop. By design it trades rarely and
 * holds for long stretches, capturing the persistent trends BTC shows. Opposite family to
 * the mean-reversion basket. Uses only price/ATR.
 * When it buys and sells: Buy when price closes above the 20-day high AND price is above the
 * 200-day average (long-only trend regime). Sell when price closes below the highest high
 * since entry minus 4x ATR (a wide chandelier stop that avoids chop whipsaw).
 * When it does NOT work: In a range-bound / sideways market with no sustained breakouts it
 * buys false breakouts and the trailing stop gives back the small gains — trend following
 * bleeds in chop. It also gives up the top of a parabolic blow-off because the trailing stop
 * lags the peak.
 * Display-only change: added ctx.watch declarations, trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const high20 = ctx.high(20, 1);
  if (atr == null || sma200 == null || high20 == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    const hi = ctx.state.highestHigh || price;
    const stopPx = hi - 4.0 * atr;
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'Chandelier stop' }]);
    if (price < stopPx) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    if (price > hi) ctx.state.highestHigh = price;
    return null;
  }

  const uptrend = price > sma200 && price > high20;
  if (uptrend) {
    ctx.watch([]);
    ctx.state.highestHigh = price;
    const equity = ctx.cash + ctx.uPnl;
    const qty = (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash) / price;
    return { side: 'buy', qty: qty * 0.98 };
  }

  const entryLevel = Math.max(sma200, high20);
  ctx.watch([{
    side: 'buy',
    price: entryLevel,
    trigger: 'above',
    note: '20d high + 200d avg',
    conds: [
      { label: 'close > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'close > 20d high', now: price, op: '>', ref: high20 },
    ],
  }]);
  return null;
}
