/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation 4H v2
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: cross-sectional momentum — in crypto the strongest large-cap of the
 * last ~3 weeks tends to keep outperforming until leadership flips. Instead of betting on
 * one asset's direction, this holds whichever of BTC/ETH/SOL has the strongest 120-bar
 * momentum and rotates when another takes a clear lead. Different family from trend and MR:
 * the signal is RELATIVE strength, not absolute direction.
 * When it buys and sells: every bar it ranks BTC/ETH/SOL by 120-bar momentum (closed bars).
 * Buy a symbol when it is the leader AND above its own 120-SMA; sell when it is no longer
 * the leader by a clear 1% margin (a marginal flip would only pay fees), or on a 3x ATR
 * crash stop. Per-symbol entry is tracked in shared state (ctx.entryPx is per-run, not
 * per-symbol, so it cannot be used for a per-symbol stop).
 * When it does NOT work: in a broad coordinated bear all three momentums go negative and it
 * sits in cash (safe but flat); in a choppy market where leadership flips constantly it
 * churns and pays fees. SOL only lists in Aug 2020, so early windows trade only after it
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
  if (ctx.state.closes[sym].length > 260) ctx.state.closes[sym] = ctx.state.closes[sym].slice(-260);

  // rank only when every symbol has enough closed bars (120-bar momentum needs 122 closes)
  let ready = true;
  const mom = {};
  for (const s of ctx.syms) {
    const c = ctx.state.closes[s];
    if (!c || c.length < 122) { ready = false; break; }
    const lastClosed = c[c.length - 2];   // previous closed bar (live-safe)
    const ref = c[c.length - 122];        // 120 bars before the last closed bar
    mom[s] = lastClosed / ref - 1;
  }
  if (!ready) { ctx.watch([]); return null; }

  // leader = highest momentum that is positive AND above its own 120-SMA (no falling knife,
  // no buying strength that is already reversing). 120-SMA computed from the 120 closed bars.
  let leader = null;
  let best = -Infinity;
  for (const s of ctx.syms) {
    const c = ctx.state.closes[s];
    const lastClosed = c[c.length - 2];
    let sum = 0;
    for (let k = c.length - 121; k <= c.length - 2; k++) sum += c[k];
    const sma120 = sum / 120;
    if (mom[s] > 0 && lastClosed > sma120 && mom[s] > best) { best = mom[s]; leader = s; }
  }

  const pos = ctx.pos(sym);
  const atr = ctx.atr(14, 1);

  // per-symbol entry price in shared state — ctx.entryPx is per-run, not per-symbol
  if (!ctx.state.entry) ctx.state.entry = {};
  const entry = ctx.state.entry[sym];

  if (pos > 0 && entry != null) {
    const stopPx = entry - 3 * atr;
    if (atr != null && atr > 0 && price <= stopPx) {
      delete ctx.state.entry[sym];
      ctx.watch([]); return { side: 'sell', qty: pos };
    }
    // rotate only when a DIFFERENT symbol leads by a clear 1% momentum margin —
    // a marginal flip would cost two spreads in fees for no edge
    const stillLeading = (leader === sym) || (leader != null && mom[sym] >= best - 0.01);
    if (!stillLeading) {
      delete ctx.state.entry[sym];
      ctx.watch([]); return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '3x ATR crash stop' }]);
    return null;
  }

  // flat: buy this symbol if it is the leader (ctx.cash = total equity in multi-sym mode)
  if (pos === 0 && leader === sym) {
    ctx.state.entry[sym] = price;
    const qty = (ctx.cash * 0.9) / price;
    if (qty > 0) { ctx.watch([]); return { side: 'buy', qty }; }
  }
  ctx.watch([]);
  return null;
}
