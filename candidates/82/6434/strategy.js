/*
 * @coinsori-strategy v1
 * name: 5-Asset 4H Wide Turtle Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: 4h trend-following across a basket is the only family
 * that has held up in this job. A tight Donchian channel churned 1200+
 * trades and lost money on fees — the classic turtle fixes that with a wide
 * 55-bar entry channel (only real breakouts) and a 20-bar exit (winners
 * keep breathing). Diversified over 5 assets at 15% size each.
 * When it buys and sells: buy an asset above its 200-bar SMA when it breaks
 * above its 55-bar high; exit on a close below the 20-bar low or a 2.5x ATR
 * stop. 15% of cash per position.
 * When it does NOT work: long choppy ranges still give false 55-bar
 * breakouts, and broad bear markets keep the strategy mostly in cash
 * (protection, not profit).
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const sma200 = ctx.sma(200, 1);
  const dHigh = ctx.high(55, 1);
  const dLow = ctx.low(20, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || dHigh == null || dLow == null || atr == null) return null;

  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.15;

  if (ctx.position === 0) {
    // Only real breakouts (55-bar high) inside a confirmed uptrend.
    if (price > sma200 && price > dHigh) {
      ctx.watch([{ side:'buy', price: dHigh, trigger:'above', note:'55-bar high break' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Wide 20-bar exit keeps winners; ATR stop caps the tail.
  const stop = ctx.entryPx != null ? ctx.entryPx - 2.5 * atr : null;
  ctx.watch([
    { side:'sell', price: dLow, trigger:'below', note:'20-bar low break' },
    { side:'sell', price: stop, trigger:'below', note:'ATR stop' }
  ]);
  if (price < dLow) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (stop != null && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
