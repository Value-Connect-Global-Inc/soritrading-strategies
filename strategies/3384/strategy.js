/*
 * @coinsori-strategy v1
 * name: ADA RSI2 Panic Mean-Reversion 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: RSI(2) extreme-oversold mean reversion was the one defensive idea that held up
 * on BTC 1d in this project's ledger (+95%, 16% MDD). ADA trends in cleaner waves, so panic dips
 * inside an uptrend (price above the 200-day average) tend to snap back fast. This is a different
 * family from the Donchian breakout champion: it buys fear instead of momentum.
 * When it buys and sells: Buys when RSI(2) closes below 10 while price is above the 200-day
 * average (a panic dip inside an uptrend). Sells when RSI(2) closes above 70, when price closes
 * above the highest of the last 5 days, or on an 8% stop below entry.
 * When it does NOT work: In a long bear market price stays below the 200-day average so it sits in
 * cash (fine), but in a chop with frequent panic dips it can buy too early and take small stops.
 * It never shorts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi = ctx.rsi(2, 1);
  const sma200 = ctx.sma(200, 1);
  if (rsi == null || sma200 == null) return null;

  const closes = ctx.closes;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    // 8% hard stop: caps the worst case on a panic that keeps falling.
    const stop = entry * 0.92;
    // Take profit: close above the highest of the last 5 days (quick snap-back capture).
    const high5 = Math.max(...closes.slice(-6, -2));
    const exited = rsi > 70 || prevClose > high5 || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '8% stop' }]);
    if (exited) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: RSI(2) extreme panic (<10) but only inside a long uptrend (price above 200-day avg).
  // In a bear market the dip keeps falling, so the trend gate keeps us out.
  if (rsi < 10 && prevClose > sma200) {
    ctx.watch([{ side: 'sell', price: price * 0.92, trigger: 'below', note: '8% stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
