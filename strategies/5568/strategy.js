/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Donchian Breakout Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Trend-following breakouts are the one family with positive ledger
 * evidence on this engine — Donchian was profitable in every walk-forward window on BTC/ETH
 * 1d. This runs the proven daily channel on BTC, ETH and SOL, each capped at one third of
 * the account. Daily bars avoid the 4h whipsaw that made the same idea lose on 4h.
 * When it buys and sells: A coin is bought when its previous closed daily bar breaks above
 * the highest high of the 55 days before it (new uptrend). It is sold when the close drops
 * back below the highest high of the 40 days before it — a wider exit than the entry so a
 * real trend is given room to run instead of being sold on the first pullback.
 * When it does NOT work: In a sideways market with no lasting breakouts it whipsaws — buying
 * fake breakouts and selling them at a loss. It also lags a straight-line bull because it
 * only enters after the breakout has already happened, and sits in cash between trends.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || price <= 0) return null;
  const highs = ctx.highs;
  const closes = ctx.closes;
  if (highs == null || closes == null || closes.length < 58) return null;

  // Portfolio equity = cash + all open positions (same pattern as champion 5560).
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const pos = ctx.pos(ctx.sym);
  const held = pos != null && pos > 0;

  // All on CLOSED bars (ago>=1): prevClose is the last closed bar's close.
  // Entry channel = highest high of the 55 days BEFORE that bar (bars -3..-57).
  const prevClose = closes.at(-2);
  let hi55 = -Infinity, hi40 = -Infinity;
  for (let i = 3; i <= 57; i++) { const h = highs.at(-i); if (h > hi55) hi55 = h; }
  for (let i = 3; i <= 42; i++) { const h = highs.at(-i); if (h > hi40) hi40 = h; }
  if (prevClose == null) return null;

  const SLICE = 1 / 3; // 3 coins, each gets one third of the account

  if (held) {
    // Exit: close falls back below the 40-day channel high = the trend has clearly stalled.
    if (prevClose < hi40) {
      ctx.watch([{ side: 'sell', note: 'trend broken - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: hi40, trigger: 'below', note: '40-day exit' }]);
    return null;
  }

  // Entry: close breaks above the 55-day channel high = a new uptrend is underway.
  if (prevClose <= hi55) {
    ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-day breakout' }]);
    return null;
  }

  const qty = SLICE * equity / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', note: '55-day breakout' }]);
  return { side: 'buy', qty: qty };
}
