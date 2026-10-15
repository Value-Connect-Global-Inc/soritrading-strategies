/*
 * @coinsori-strategy v1
 * name: ETH Trend (EMA50, risk 4%)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated BTC trend edge (buy above the 50-day EMA,
 * sell on a break below it) is a general trend-following idea, not specific to
 * BTC. Ethereum is the second-largest crypto and often follows the same cycles
 * with more volatility. This tests whether the same simple trend rule transfers
 * to a second asset, which would mean the edge is in the market structure, not
 * in one coin's history.
 * When it buys and sells: buys when the previous close is above the 50-day EMA.
 * Sells when price closes below the 50-day EMA or a 2.5x ATR hard stop is hit.
 * Positions risk 4% of cash per trade.
 * When it does NOT work: trend-following loses in chop and range-bound markets;
 * it also underperforms buy-and-hold in a strong persistent bull because it
 * exits on pullbacks and re-enters higher. ETH is more volatile than BTC so
 * drawdowns can be larger. No hashrate confirmation is available for ETH.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

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
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
