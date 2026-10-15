/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is driven by sentiment swings. When the Fear & Greed
 * index hits EXTREME FEAR, the crowd has capitulated and prices are often near a
 * short-term bottom — a contrarian buying opportunity. We buy the fear and sell
 * once sentiment recovers to neutral.
 * When it buys and sells: buys when the Fear & Greed index is at or below 25
 * (extreme fear). Sells when it rises back to 55 (fear recovered), the close
 * falls below the 200-day EMA (protects against a prolonged bear), or a 15%
 * hard stop is hit.
 * When it does NOT work: in a real bear market the index can stay in extreme fear
 * for months — buying every dip bleeds out. It also has no trend edge, so it
 * underperforms in steady bull markets where fear rarely gets extreme.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;   // no sentiment data -> do nothing

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // prolonged bear -> out
    if (fg >= 55) return { side: 'sell', qty: pos };             // fear recovered -> take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' },
               { side: 'sell', price: 55, trigger: 'above', note: 'FG >= 55 take profit',
                 conds: [{ label: 'FG index', now: fg, op: '>=', ref: 55, closed: true }] }]);
    return null;
  }

  const extremeFear = fg <= 25;
  ctx.watch([{ side: 'buy', price: null, trigger: 'above', note: 'FG <= 25 extreme fear',
               conds: [{ label: 'FG index', now: fg, op: '<=', ref: 25, closed: true }] }]);
  if (!extremeFear) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
