/*
 * @coinsori-strategy v1
 * name: Crypto Relative Strength Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto, the strongest asset in a cycle keeps leading
 * — when Bitcoin rallies, one alt usually rallies more. Instead of holding a
 * single coin, this ranks several majors by their recent momentum and holds
 * the strongest one, rotating only when another clearly takes over. This
 * captures the leading asset's extra return, which holding a single coin
 * misses.
 * When it buys and sells: Every bar we compare the 4h momentum (rate of
 * change) of BTC, ETH and SOL over the last 24 bars. We hold the one with the
 * strongest momentum. We switch coins only when another coin's momentum
 * exceeds the current holding's by a margin (to avoid flip-flopping).
 * When it does NOT work: When all majors move together in lockstep (a broad
 * market-wide move), relative strength adds little and rotation just pays
 * fees. In a regime where the "leader" mean-reverts sharply, we buy the top
 * right before it falls.
 */
function onUpdate(ctx) {
  ctx.state = ctx.state || {};
  if (!ctx.state.warm) { ctx.state.warm = true; ctx.watch([]); return null; }

  const syms = ctx.syms || [];
  if (syms.length < 2) { ctx.watch([]); return null; }

  const MOM = 24;          // momentum lookback in bars (4 days on 4h)
  const SWITCH_MARGIN = 0.03; // only rotate when the new leader leads by 3%

  // Build a rolling history of each symbol's price from ctx.market(s).price.
  ctx.state.hist = ctx.state.hist || {};
  for (const s of syms) {
    const m = ctx.market(s);
    if (!m || m.price == null) continue;
    ctx.state.hist[s] = ctx.state.hist[s] || [];
    const h = ctx.state.hist[s];
    h.push(m.price);
    if (h.length > MOM + 2) h.shift();
  }

  // Momentum per symbol: current price vs price MOM bars ago.
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

  // Already holding the strongest coin: stay.
  if (pos !== 0 && curSym === best) {
    ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: ctx.price, trigger: pos > 0 ? 'below' : 'above', note: 'hold leader' }]);
    return null;
  }

  // Holding a weaker coin: rotate only if the new leader is clearly ahead.
  if (pos !== 0 && curSym !== best) {
    const h = ctx.state.hist[curSym];
    const curMom = (h && h.length >= MOM + 1 && h[h.length - 1 - MOM] > 0)
      ? h[h.length - 1] / h[h.length - 1 - MOM] - 1 : -Infinity;
    if (bestMom - curMom < SWITCH_MARGIN) {
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
