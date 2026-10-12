/*
 * @coinsori-strategy v1
 * name: MultiAssetDonchianVolTarget
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: same validated multi-asset Donchian breakout recipe as the
 * champion, but position size is scaled by each asset's own volatility so the
 * basket is not dominated by the highest-volatility coin and drawdowns are smaller.
 * When it buys and sells: buys a share of equity (max 25%) when a coin closes at a
 * new 55-day high; sells on a 20-day low or a hard 2x ATR stop. The share is
 * reduced for coins whose 14-day ATR is large relative to price.
 * When it does NOT work: in a broad coordinated crypto bear every trend breaks and
 * the 20-day low gives back part of each move; in a long flat market the 55-day
 * highs are hit repeatedly and whipsaw. It also lags a single-coin melt-up because
 * high-vol coins are deliberately under-weighted.
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

  // Vol-target sizing: scale the 25% base weight down for coins whose 14-day ATR
  // is large relative to price, so each leg contributes similar daily risk.
  const atrPct = atr / price;
  const targetAtrPct = 0.03; // reference: ~3% daily move gets full 25% weight
  const weight = Math.min(0.25, 0.25 * targetAtrPct / atrPct);

  const pos = ctx.pos(sym);
  const legQty = (ctx.cash / price) * weight;

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
