/*
 * @coinsori-strategy v1
 * name: BTC Panic Mean-Reversion 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin panic dips (2-period RSI below 10) historically
 * revert — extreme fear is followed by a bounce. We buy the panic and sell
 * back toward the mean, but only inside a longer uptrend.
 * When it buys and sells: buy when a closed bar's RSI(2) < 10 AND price is
 * above the 200-day average (so we are not catching falling knives in a bear).
 * Sell when a closed bar's RSI(2) > 55 or price climbs back above the 20-day
 * average. A hard 3-ATR stop limits the damage if the panic turns into a crash.
 * When it does NOT work: in a long sustained bear there is no entry (trend gate
 * stays off) — safe but flat. In a strong uptrend there is no panic to buy.
 * If a dip inside an uptrend keeps going, the 3-ATR stop still takes the loss.
 * Strategy is long-only.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 220) return null;
  const prevClose = closes[n - 2];
  if (prevClose == null) return null;

  const rsi2 = ctx.rsi(2, 1);
  const sma20 = ctx.sma(20, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (rsi2 == null || sma20 == null || sma200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 3 * atr;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'mean target' },
      { side: 'sell', price: stop, trigger: 'below', note: '3 ATR stop' }
    ]);
    // exit: closed bar back above RSI 55 OR price back above 20-day mean OR hard stop
    if (rsi2 > 55 || prevClose > sma20 || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // entry: capitulation on a closed bar, only inside an uptrend (above SMA200)
  // the trend gate is what keeps us from buying falling knives in a bear
  if (rsi2 < 10 && prevClose > sma200) {
    ctx.watch([{ side: 'sell', price: price - 3 * atr, trigger: 'below', note: '3 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * 0.5 };
  }
  return null;
}
