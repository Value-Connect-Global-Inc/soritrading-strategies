/*
 * @coinsori-strategy v1
 * name: MultiAssetDonchianTrend
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sustained trends in crypto start with a breakout — price makes a
 * new multi-week high and keeps going. The single-asset Donchian system is the
 * validated champion on BTC; this version runs that proven recipe on four assets at
 * once so the portfolio can capture a trend in any of them and is not tied to BTC.
 * When it buys and sells: on each asset, buys a 25% share of equity when its last
 * close is a new 55-day high; sells when it is a 20-day low, or on a hard 2x ATR
 * stop below entry. Each asset trades independently.
 * When it does NOT work: in a broad coordinated crypto bear every trend breaks and
 * the 20-day low gives back part of each move; in a long flat market the 55-day
 * highs are hit repeatedly and whipsaw. It also lags a single straight-line melt-up
 * of one asset because each leg is only 25% of equity.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);     // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.pos(sym);
  const legQty = (ctx.cash / price) * 0.25; // 25% of equity per leg, 4 legs = full book

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
    ctx.watch([]);
    return { side: 'buy', qty: legQty };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
