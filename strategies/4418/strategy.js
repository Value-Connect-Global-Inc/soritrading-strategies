/*
 * @coinsori-strategy v1
 * name: ETH 1D Trend Ride Fixed Stop
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the validated BTC on-chain champion proved that "long-term
 * trend + fixed 2.5x ATR hard stop + small risk per trade" is a robust recipe
 * with low drawdown. This applies the same price-only recipe to ETH — no fragile
 * filters, just ride the 200-day trend and cut losers fast.
 * When it buys and sells: buys when the previous close is above the 200-day EMA
 * (long-term uptrend). Sells when price closes below the 200-day EMA or a 2.5x
 * ATR hard stop below entry is hit.
 * When it does NOT work: in a choppy sideways market the 200-day EMA whipsaws
 * entries; in a fast crash the 2.5x ATR stop is the only protection and can
 * still be hit by gap. It is trend-following, so it does not profit from
 * range-bound price action.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend) return null;

  const riskCash = ctx.cash * 0.02;        // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
