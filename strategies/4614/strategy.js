/*
 * @coinsori-strategy v1
 * name: Momentum Rotation Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: instead of holding a fixed basket like the champion, this
 * rotates into the two STRONGEST coins by 50/200-EMA momentum. The bet: in a
 * market where only some coins lead, favoring the leaders captures the move
 * while avoiding the laggards; holding two (not one) halves single-coin tail
 * risk, and the 2.5-ATR stop caps each position.
 * When it buys and sells: every bar each coin records its own momentum
 * (EMA50/EMA200 - 1) in shared state; a coin is bought only when it is one of
 * the two strongest of the four and clearly trending (momentum > 2%). Sell on
 * the death cross or the 2.5-ATR stop, 24-bar cooldown after an exit.
 * When it does NOT work: when leadership rotates quickly the rotation churns and
 * pays fees on lag; in a broad meltdown all coins fall together so favoring the
 * leaders does not help; the recent window showed concentration can still give
 * deep drawdowns when the leaders roll over.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const f = ctx.ema(50, 1), s = ctx.ema(200, 1);
  if (f == null || s == null || s <= 0) return null;
  const mom = f / s - 1;

  const st = ctx.state || {};
  if (!st.mom) st.mom = {}; // shared across symbols: sym -> its momentum
  st.mom[ctx.sym] = mom;

  // Rank all recorded coins by momentum, keep the top two.
  const ranked = Object.keys(st.mom).sort((a, b) => st.mom[b] - st.mom[a]);
  const top2 = ranked.slice(0, 2);
  const inTop2 = top2.indexOf(ctx.sym) !== -1;

  const sym = ctx.sym;
  if (!st.cool) st.cool = {};
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry - 2.5 * atr : price - 2.5 * atr;
    // Exit if this coin drops out of the top two, the trend died, or the stop hit.
    if (!inTop2 || f <= s || price <= stopPx) { st.cool[sym] = ctx.i; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 2.5 ATR' }]);
    return null;
  }

  const lastExit = st.cool[sym];
  if (lastExit != null && ctx.i - lastExit < 24) return null;
  // Only buy a top-2 leader, and only if it is clearly trending (momentum > 2%).
  if (!inTop2 || mom < 0.02) return null;

  const riskCash = ctx.cash * 0.0125;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
