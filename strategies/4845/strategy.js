/*
 * @coinsori-strategy v1
 * name: BtcDonchianBreakout1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's biggest gains come in sustained trends that start with a
 *   breakout above a long consolidation. A Donchian 55-bar high breakout catches those
 *   runs early, and a 20-bar low (or 2x ATR) exit rides the trend while cutting losses
 *   fast. This is the most proven family in this ledger (prior runs +240% / +162% on
 *   disjoint BTC 1d windows).
 * When it buys and sells: buys when the previous day's close breaks above the highest
 *   high of the last 55 days. Sells when price falls below the lowest low of the last
 *   20 days, or when it drops 2x ATR below the entry price (hard stop). Position size
 *   risks only 2% of the account on that stop.
 * When it does NOT work: in long sideways chop the breakout whipsaws — each fakeout
 *   takes the 2% stop. Long-only means a sustained bear market is mostly flat-to-loss
 *   (it never shorts). It also underperforms buy&hold in a straight one-way bull run
 *   because it sits in cash between trends.
 */

function onUpdate(ctx) {
  // Donchian levels from CLOSED bars only (ago>=2) — identical in backtest, paper and live.
  const entryHigh = ctx.high(55, 2);  // highest high of the 55 days before the previous day
  const exitLow = ctx.low(20, 2);     // lowest low of the 20 days before the previous day
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // 2x ATR stop from entry: the trend should not give back more than 2 ATRs.
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx || prevClose < exitLow) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: '2x ATR stop' },
      { side: 'sell', price: exitLow, trigger: 'below', note: '20-day low exit' }
    ]);
    return null;
  }

  // Entry: previous close breaks above the 55-day high (a fresh trend start).
  if (prevClose <= entryHigh) return null;

  // Size so a 2x ATR adverse move costs 2% of the account (risk-based sizing).
  const stopDist = 2 * atr;
  let qty = (ctx.cash * 0.02) / stopDist;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55-day breakout' }]);
  return { side: 'buy', qty };
}
