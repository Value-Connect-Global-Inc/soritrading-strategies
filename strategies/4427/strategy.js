/*
 * @coinsori-strategy v1
 * name: Two-Trend BTC (EMA50 + EMA200 agreement, risk 4%)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A trend signal is strongest when the fast and slow trend
 * lines agree. Buying only when price is above BOTH the 50-day EMA and the
 * 200-day EMA filters out whipsaw entries in the early stage of a rally, when
 * the 50-day alone would already trigger. The slow 200-day line is a regime
 * check, not a trading signal.
 * When it buys and sells: buys when the previous close is above the 50-day EMA
 * AND above the 200-day EMA. Sells when price closes below the 50-day EMA or a
 * 2.5x ATR hard stop is hit. Positions risk 4% of cash per trade.
 * When it does NOT work: in a strong bull market it waits for the 200-day line
 * to agree so it enters late and misses part of the move; it also stays out of
 * early recoveries after a crash. Trend-following means it loses in chop, and
 * the stricter entry means it is more conservative than a single-EMA strategy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend50 = prevClose > ema50;
  const uptrend200 = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend50, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend200, closed: true }] }]);
  if (!uptrend50 || !uptrend200) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
