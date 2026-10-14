/*
 * @coinsori-strategy v1
 * name: 4H Multi-Asset EMA Trend
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The 1d Donchian champion catches weekly moves but eats
 *   deep drawdowns (62-76%). On 4h, EMA20/EMA50 crossovers react faster to a
 *   trend turning down, so this rides the same bull trends with a shorter
 *   leash. It is a different family from the champion: smooth EMA follow,
 *   not channel breakouts.
 * When it buys and sells: buy when EMA20 crosses above EMA50 with price above
 *   both; sell when EMA20 crosses below EMA50, or a 3x ATR hard stop.
 * When it does NOT work: in a 4h chop (sideways) the fast/slow EMA cross
 *   repeatedly and fee-bleed; in a sharp crash the 3x ATR stop still gives
 *   back a lot. It is long-only, so a prolonged bear has no income.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const e20 = ctx.ema(20, 1);
  const e50 = ctx.ema(50, 1);
  if (atr == null || atr <= 0 || e20 == null || e50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (e20 < e50) return { side: 'sell', qty: pos };  // trend turned down
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR stop' },
               { side: 'sell', price: e50, trigger: 'below', note: 'EMA20<EMA50' }]);
    return null;
  }

  const e20_2 = ctx.ema(20, 2), e50_2 = ctx.ema(50, 2);
  if (e20_2 == null || e50_2 == null) return null;
  const crossUp = e20_2 <= e50_2 && e20 > e50;  // closed bars only
  if (!crossUp) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
