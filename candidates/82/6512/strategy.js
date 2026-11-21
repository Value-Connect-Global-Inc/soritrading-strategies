/*
 * @coinsori-strategy v1
 * name: Crypto Slow Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto the strongest asset in a cycle keeps leading
 * for weeks. This ranks BTC, ETH and SOL by SLOW momentum (over ~16 days) and
 * holds the leader, rotating only rarely. Slow momentum and a long minimum
 * holding period avoid the churn that kills fast rotation — we pay fees only
 * on real leadership changes, not on daily noise.
 * When it buys and sells: Every bar we compute each coin's 100-bar momentum.
 * We hold the coin with the strongest momentum. We switch only when another
 * coin leads by a clear margin (8%) AND we have held the current coin for at
 * least 30 bars (5 days). A hard stop-loss (25% below entry) protects against
 * crashes while we wait for the slow signal to turn.
 * When it does NOT work: When all majors move in lockstep (broad market
 * moves), relative strength adds nothing and rotation only pays fees. A
 * sharp mean-reversion of the leader right after we buy it hurts.
 */
function onUpdate(ctx) {
  ctx.state = ctx.state || {};
  if (!ctx.state.warm) { ctx.state.warm = true; ctx.watch([]); return null; }

  const syms = ctx.syms || [];
  if (syms.length < 2) { ctx.watch([]); return null; }

  const MOM = 100;          // slow momentum lookback (16 days on 4h)
  const SWITCH_MARGIN = 0.08; // only rotate when new leader leads by 8%
  const MIN_HOLD = 30;      // minimum holding period in bars (5 days)
  const STOP_PCT = 0.75;    // hard stop: exit if price falls 25% below entry

  // Rolling price history per symbol.
  ctx.state.hist = ctx.state.hist || {};
  for (const s of syms) {
    const m = ctx.market(s);
    if (!m || m.price == null) continue;
    ctx.state.hist[s] = ctx.state.hist[s] || [];
    const h = ctx.state.hist[s];
    h.push(m.price);
    if (h.length > MOM + 2) h.shift();
  }

  let best = null;
  let bestMom = -Infinity;
  for (const s of syms) {
    const h = ctx.state.hist[s];
    if (!h || h.length < MOM + 1) continue;
    const prev = h[h.length - 1 - MOM];
    const cur = h[h.length - 1];
    if (prev == null || cur == null || prev <= 0) continue;
    const mom = cur / prev - 1;
    if (mom > bestMom) { bestMom = mom; best = s; }
  }
  if (!best) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const curSym = ctx.sym;

  // Track how long we have held the current position.
  if (pos !== 0 && ctx.state.holdSym !== curSym) {
    ctx.state.holdSym = curSym;
    ctx.state.holdBars = 1;
  } else if (pos !== 0) {
    ctx.state.holdBars = (ctx.state.holdBars || 0) + 1;
  }

  // While holding: hard stop-loss check first.
  if (pos > 0 && ctx.entryPx != null) {
    const stop = ctx.entryPx * STOP_PCT;
    // stop-loss applies regardless of rotation logic
    if (ctx.price <= stop) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
  }

  // Already holding the strongest coin: stay.
  if (pos !== 0 && curSym === best) {
    ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: ctx.price, trigger: pos > 0 ? 'below' : 'above', note: 'hold leader' }]);
    return null;
  }

  // Holding a weaker coin: rotate only if clearly ahead AND held long enough.
  if (pos !== 0 && curSym !== best) {
    const h = ctx.state.hist[curSym];
    const curMom = (h && h.length >= MOM + 1 && h[h.length - 1 - MOM] > 0)
      ? h[h.length - 1] / h[h.length - 1 - MOM] - 1 : -Infinity;
    const heldLongEnough = (ctx.state.holdBars || 0) >= MIN_HOLD;
    if (bestMom - curMom < SWITCH_MARGIN || !heldLongEnough) {
      ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: ctx.price, trigger: pos > 0 ? 'below' : 'above', note: 'keep current' }]);
      return null;
    }
    ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: ctx.price, trigger: pos > 0 ? 'below' : 'above', note: 'rotate to ' + best }]);
    return [{ side: pos > 0 ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true },
            { side: 'buy', qty: ctx.cash / ctx.price * 0.98 }];
  }

  // Flat: buy the strongest coin.
  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'above', note: 'buy leader ' + best }]);
  return { side: 'buy', qty: ctx.cash / ctx.price * 0.98 };
}
