/*
 * @coinsori-strategy v1
 * name: DonchianRiskSized
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Turtle breakout has a real edge, but betting full cash on
 * every 55-day high gives it ~40% drawdowns. Instead of changing the signal, this
 * keeps the same entry/exit and sizes each position so that the 2x ATR stop risks
 * only a fixed 2% of the account. Risk is capped before returns are chased.
 * When it buys and sells: buys when the previous close is a new 55-day high, sized
 * so a 2x ATR stop loses 2% of equity; sells on a 20-day low or the 2x ATR stop.
 * When it does NOT work: it will never match the full-cash version's headline
 * returns in a straight bull, because it commits less capital; in a sideways
 * market the same whipsaw applies but with smaller losses.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);    // 20-bar low, 2 bars back
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  if (prevClose > entryHigh) {
    // Size so the 2x ATR stop risks 2% of equity — fixed-fractional risk sizing.
    // Risk 2% is standard for trend systems; it caps a single bad trade.
    const stopDist = 2 * atr;
    const riskCash = ctx.cash * 0.02;
    const qty = riskCash / stopDist;
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
