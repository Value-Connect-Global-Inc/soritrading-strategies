/*
 * @coinsori-strategy v1
 * name: FearGreed Panic-End Recovery BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) measures crowd
 * emotion. Buying DURING extreme fear catches a falling knife (price can keep
 * crashing for months). Instead this strategy waits for the panic to END: it
 * buys when the index crosses back up through 25 (fear is receding, the bottom
 * is in) and sells when euphoria fades (index crosses back down through 75).
 * When it buys and sells: buys when yesterday's index crossed up through 25
 * from extreme fear. Sells when the index crosses down through 75 (greed is
 * fading) or a hard stop 25% below entry is hit. Uses 90% of cash per trade.
 * Only closed-bar index values are used (no lookahead).
 * When it does NOT work: a panic that resumes into a full bear market (e.g.
 * late 2025 into 2026) still hits the stop — the stop caps each loss but a
 * sequence of them hurts. It also sits in cash through long quiet bull grinds
 * where the index never gets extreme, so it lags buy-and-hold in strong bull
 * markets.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const fgVal = Number(fg);
  if (!Number.isFinite(fgVal)) return null;

  // Track the last two closed days of the index (both ago>=1, no lookahead)
  const fgPrev = ctx.state.fgPrev;   // yesterday
  const fg2 = ctx.state.fg2;         // day before yesterday
  ctx.state.fg2 = fgPrev;
  ctx.state.fgPrev = fgVal;
  if (fgPrev == null || fg2 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;   // hard stop: 25% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const euphFading = fgPrev < 75 && fg2 >= 75;   // greed ended -> take profit
    if (euphFading) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: ctx.entryPx, trigger: 'above', note: 'euphoria fade exit',
                 conds: [{ label: 'Fear&Greed yest', now: fgPrev, op: '<', ref: 75, closed: true },
                         { label: 'Fear&Greed 2d', now: fg2, op: '>=', ref: 75, closed: true }] }]);
    return null;
  }

  const panicEnd = fgPrev > 25 && fg2 <= 25;   // panic ended -> buy the recovery
  if (!panicEnd) return null;

  const qty = (ctx.cash / price) * 0.9;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
