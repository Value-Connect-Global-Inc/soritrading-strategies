/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL Donchian Breakout Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following breakouts are the one family with positive ledger
 * evidence on this engine (Donchian was profitable in every walk-forward window on BTC/ETH
 * 1d, and on ETH 4h). This runs the same 55-bar entry / 30-bar exit Donchian channel on
 * BTC, ETH and SOL, each capped at one third of the account, sized by inverse ATR.
 * When it buys and sells: A coin is bought when its previous closed bar breaks above the
 * highest high of the 55 bars BEFORE it (new uptrend). It is sold when the close drops back
 * below the highest high of the 30 bars before it (trend losing steam). Inverse-ATR sizing
 * means it takes bigger positions in calm trends and smaller ones in wild moves.
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
  // Entry channel = highest high of the 55 bars BEFORE that bar (bars -3..-57),
  // so a bar's own high can never block its own breakout.
  const prevClose = closes.at(-2);
  let hi55 = -Infinity, hi30 = -Infinity;
  for (let i = 3; i <= 57; i++) { const h = highs.at(-i); if (h > hi55) hi55 = h; }
  for (let i = 3; i <= 32; i++) { const h = highs.at(-i); if (h > hi30) hi30 = h; }
  const atr = ctx.atr(14, 1);
  if (prevClose == null || atr == null || atr <= 0) return null;

  const SLICE = 1 / 3; // 3 coins, each gets one third of the account

  if (held) {
    // Exit: close falls back below the 30-bar channel high = the trend has lost steam.
    if (prevClose < hi30) {
      ctx.watch([{ side: 'sell', note: 'trend broken - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: hi30, trigger: 'below', note: '30-bar exit' }]);
    return null;
  }

  // Entry: close breaks above the 55-bar channel high = a new uptrend is underway.
  if (prevClose <= hi55) {
    ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: '55-bar breakout' }]);
    return null;
  }

  // Inverse-ATR sizing: cap each coin at its 1/3 slice, scaled down by how volatile it is.
  const volFrac = Math.min(1.0, 0.02 / (atr / price));
  const qty = SLICE * Math.max(volFrac, 0.15) * equity / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', note: '55-bar breakout' }]);
  return { side: 'buy', qty: qty };
}
