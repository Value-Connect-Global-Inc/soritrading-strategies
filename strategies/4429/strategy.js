/*
 * @coinsori-strategy v1
 * name: FearGreed Deep-Panic Recovery BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) is noisy — it can
 * wobble across a threshold on a single day. A real panic is SUSTAINED: the
 * index stays below 25 for several days. This strategy only buys after two
 * consecutive extreme-fear days (a genuine panic), and sells when greed fades.
 * When it buys and sells: buys when the index has been below 25 for two
 * straight days and then crosses back above (panic ending). Sells when the
 * index crosses back down through 75 (euphoria fading) or a wide 40% stop is
 * hit. Uses 90% of cash. Only closed-bar values (no lookahead).
 * When it does NOT work: in a long bear the index stays below 25 for months —
 * the two-day rule fires, the wide stop caps the loss, but repeated panic
 * recoveries that fail (2022, 2025-26) still string stop-outs together. It
 * also sits in cash through quiet bull grinds where greed never gets extreme.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const fgVal = Number(fg);
  if (!Number.isFinite(fgVal)) return null;

  // Track last three closed days (all ago>=1, no lookahead)
  const fgPrev = ctx.state.fgPrev;   // yesterday
  const fg2 = ctx.state.fg2;         // 2 days ago
  const fg3 = ctx.state.fg3;         // 3 days ago
  ctx.state.fg3 = fg2;
  ctx.state.fg2 = fgPrev;
  ctx.state.fgPrev = fgVal;
  if (fgPrev == null || fg2 == null || fg3 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.6;   // wide stop: a real panic that becomes a bear
    if (price <= stop) return { side: 'sell', qty: pos };
    const euphFade = fgPrev < 75 && fg2 >= 75;   // greed faded -> take profit
    if (euphFade) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '40% stop' },
               { side: 'sell', price: ctx.entryPx, trigger: 'above', note: 'euphoria fade exit',
                 conds: [{ label: 'Fear&Greed yest', now: fgPrev, op: '<', ref: 75, closed: true },
                         { label: 'Fear&Greed 2d', now: fg2, op: '>=', ref: 75, closed: true }] }]);
    return null;
  }

  // Panic end: two straight days <25, then a day back above 25
  const panicEnd = fgPrev > 25 && fg2 < 25 && fg3 < 25;
  if (!panicEnd) return null;

  const qty = (ctx.cash / price) * 0.9;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
