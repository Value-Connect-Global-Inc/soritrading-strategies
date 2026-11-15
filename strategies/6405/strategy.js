/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed index measures crowd sentiment. Historically, extreme
 * fear (index < 25) inside an uptrend marks a panic dip that tends to recover, while extreme greed
 * marks overheated tops. We bet on that mean reversion of sentiment.
 * When it buys and sells: Buy when the index is in extreme fear AND price is still above its 200-day
 * average (we only catch dips inside an uptrend, never a bear-market knife). Sell when fear subsides
 * (index back above 55), when the 50-day trend breaks, or on a hard 3xATR stop.
 * When it does NOT work: In a sustained bear market price stays below the 200-day average so we never
 * buy (that is the filter working). In a long one-way bull with no fear dips we are mostly in cash and
 * underperform buy-and-hold. Frequent small whipsaws near the fear/greed boundary pay fees.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  if (fg == null) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null) return null;

  const price = ctx.price;
  const inPos = ctx.position > 0;

  // Hard stop: 3x ATR below entry, protects the account from a single bad dip.
  const stopPx = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;

  if (inPos) {
    // Exit when fear subsides (index > 55 = neutral/greed), trend breaks, or stop hit.
    const exit = fg > 55 || price < sma50 || (stopPx != null && price <= stopPx);
    if (exit) {
      ctx.watch([
        { side: 'sell', price: stopPx != null ? stopPx : price, trigger: 'below', note: '3xATR stop' },
        { side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }
      ]);
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([
      { side: 'sell', price: stopPx != null ? stopPx : price, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }
    ]);
    return null;
  }

  // Entry: extreme fear (index < 25, the published "extreme fear" band) inside an uptrend.
  const buy = fg < 25 && price > sma200;
  if (buy) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200' }
    ]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'price above SMA200' },
    { side: 'buy', price: sma200, trigger: 'below', note: 'fear dip' }
  ]);
  return null;
}
