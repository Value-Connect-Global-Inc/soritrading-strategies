/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: cross-sectional momentum — in crypto, the strongest large-cap of the
 * last week tends to keep outperforming until leadership flips. Instead of betting on one
 * asset's direction, this holds whichever of BTC/ETH/SOL has the strongest 40-bar momentum
 * and rotates when another takes over. Different family from trend-following and MR: the
 * signal is RELATIVE strength, not absolute direction.
 * When it buys and sells: every bar it ranks BTC/ETH/SOL by 40-bar momentum (closed bars).
 * If a symbol is the leader with positive momentum and we are flat in it, buy full equity.
 * If we hold a symbol and it is no longer the leader, sell (the new leader gets bought on
 * its own tick). A 3x ATR stop protects against a sudden crash while held.
 * When it does NOT work: in a broad coordinated bear all three momentums are negative and
 * it sits in cash (safe but flat); in a choppy market where leadership flips every few bars
 * it churns and pays fees. SOL only lists in Aug 2020, so early windows trade only after it
 * has data.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  // shared per-symbol close history (ctx.state is one object for the whole run)
  if (!ctx.state.closes) ctx.state.closes = {};
  if (!ctx.state.closes[sym]) ctx.state.closes[sym] = [];
  ctx.state.closes[sym].push(price);
  if (ctx.state.closes[sym].length > 60) ctx.state.closes[sym] = ctx.state.closes[sym].slice(-60);

  // rank only when every symbol has enough closed bars (40-bar momentum needs 42 closes)
  let ready = true;
  const mom = {};
  for (const s of ctx.syms) {
    const c = ctx.state.closes[s];
    if (!c || c.length < 42) { ready = false; break; }
    const lastClosed = c[c.length - 2];   // previous closed bar (live-safe, same as backtest)
    const ref = c[c.length - 42];         // 40 bars before the last closed bar
    mom[s] = lastClosed / ref - 1;
  }
  if (!ready) { ctx.watch([]); return null; }

  // leader = highest momentum, and it must be positive (no holding a falling knife)
  let leader = null;
  let best = 0;
  for (const s of ctx.syms) {
    if (mom[s] > best) { best = mom[s]; leader = s; }
  }

  const pos = ctx.pos(sym);
  const atr = ctx.atr(14, 1);

  if (pos > 0) {
    // tail-risk stop: a 3x ATR crash while holding should not be held through
    if (atr != null && atr > 0 && price <= ctx.entryPx - 3 * atr) {
      ctx.watch([]); return { side: 'sell', qty: pos };
    }
    // rotation exit: no longer the leader -> sell; the new leader buys on its own tick
    if (leader !== sym) {
      ctx.watch([]); return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR crash stop' }]);
    return null;
  }

  // flat: buy this symbol if it is the leader
  if (leader === sym) {
    const qty = (ctx.cash * 0.99) / price;
    if (qty > 0) { ctx.watch([]); return { side: 'buy', qty }; }
  }
  ctx.watch([]);
  return null;
}
