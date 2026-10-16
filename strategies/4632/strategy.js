/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd fear creates bargains, crowd greed creates tops —
 * but only inside an intact long-term uptrend. When BTC is above its 200-day
 * EMA and the Fear & Greed index drops to extreme fear, that is a panic that
 * tends to revert; when it reaches extreme greed, we take profits.
 * When it buys and sells: buy when the last closed bar is above the 200-day EMA
 * and the Fear & Greed index is below 30. Sell when the index exceeds 70, the
 * price closes below the 200-day EMA, or a 15% hard stop is hit.
 * When it does NOT work: in a prolonged bear market the 200-day filter keeps you
 * out (good), but during a violent crash the index can hit extreme fear while
 * price is still above the EMA and keep falling — the stop is what saves you.
 * It also misses rallies that start from neutral sentiment (no extreme fear print).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 2) return null;
  const prevClose = c.at(-2);

  const fg = ctx.data('fear_greed');   // 0..100 sentiment, null = not ready
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (fg != null && fg > 70) return { side: 'sell', qty: pos }; // extreme greed = take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'Fear&Greed < 70', ok: fg == null || fg <= 70, closed: true }] },
               { side: 'sell', price: 70, trigger: 'above', note: 'extreme greed exit',
                 conds: [{ label: 'F&G index', now: fg, op: '>', ref: 70, closed: true }] }]);
    return null;
  }

  // need sentiment data; without it we cannot know fear -> stay flat
  if (fg == null) return null;
  if (fg > 30) return null;   // only act on extreme fear (index < 30)
  const uptrend = prevClose > ema200;
  if (!uptrend) return null;  // don't catch falling knives in a bear market

  ctx.watch([{ side: 'buy', price: 30, trigger: 'below', note: 'extreme fear',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'F&G index', now: fg, op: '<', ref: 30, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);   // wild coin smaller, calm coin bigger
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
