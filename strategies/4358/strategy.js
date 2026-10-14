/*
 * @coinsori-strategy v1
 * name: Champion Comparison Copy
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: EXACT copy of champion 4346 (Multi-Asset Donchian Basket
 *   1D) re-saved as a separate id so it can be run on the SAME windows as the
 *   new Volatility Squeeze strategy for a fair head-to-head. Logic unchanged.
 * When it buys and sells: identical to 4346 — 55-bar high breakout entry,
 *   20-bar low / 2.5x ATR stop / 100-EMA exits, 20% per leg.
 * When it does NOT work: identical to 4346.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;  // not enough history yet
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;  // need a fresh 55-bar high close
  if (prevClose < ema100) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
