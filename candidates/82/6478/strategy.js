/*
 * @coinsori-strategy v1
 * name: BTC Two-Sided Mean Reversion 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Mean reversion in BOTH directions on BTC perpetuals. The long-only spot
 * version sat in cash and missed the bull; adding the short side lets it
 * also profit from overextended rallies in downtrends. When it buys and
 * sells: LONG a deep dip (z<=-1.2) while price is above the 200-EMA and
 * sell back at the 50-bar mean; SHORT an overextension (z>=+1.2) while
 * price is below the 200-EMA and buy back at the mean. Hard 3xATR stop
 * both ways, 24-bar time stop, small fixed risk per trade.
 * When it does NOT work: in a strong one-way bull the short side gets
 * squeezed on every overextension; in choppy sideways the mean is hit
 * repeatedly both ways and fees accumulate.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const sma50 = ctx.sma(50, 1);
  const z = ctx.zscore(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || sma50 == null || z == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  // cooldown after any exit (ours or a platform forced close)
  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) {
    ctx.state.skipUntil = ctx.i + 6;
  }
  ctx.state.lastPos = pos;

  // --- manage an open position ---
  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    const entryBar = ctx.state.entryBar;
    const timeStopAt = entryBar != null && ctx.times[entryBar] != null
      ? ctx.times[entryBar] + 24 * 4 * 3600 : null;
    const w = [
      { side: 'sell', price: sma50, trigger: 'above', note: 'mean target' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'regime flip' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ];
    if (timeStopAt != null) w.push({ side: 'sell', at: timeStopAt, note: 'time stop' });
    ctx.watch(w);
    if (prevClose != null && prevClose >= sma50) return { side: 'sell', qty: pos, reduceOnly: true };
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entryBar != null && ctx.i - entryBar >= 24) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (pos < 0) {
    const stop = (entryPx != null ? entryPx : price) + 3 * atr;
    const entryBar = ctx.state.entryBar;
    const timeStopAt = entryBar != null && ctx.times[entryBar] != null
      ? ctx.times[entryBar] + 24 * 4 * 3600 : null;
    const w = [
      { side: 'buy', price: sma50, trigger: 'below', note: 'mean target' },
      { side: 'buy', price: ema200, trigger: 'above', note: 'regime flip' },
      { side: 'buy', price: stop, trigger: 'above', note: 'hard stop' }
    ];
    if (timeStopAt != null) w.push({ side: 'buy', at: timeStopAt, note: 'time stop' });
    ctx.watch(w);
    if (prevClose != null && prevClose <= sma50) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (prevClose != null && prevClose > ema200) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (price >= stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (entryBar != null && ctx.i - entryBar >= 24) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // no new entries right after a platform forced close (edge is reduce-only).
  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (alloc != null && alloc.lastForced != null) {
    const lf = alloc.lastForced;
    if (typeof lf === 'number') {
      const nowT = ctx.times.at(-1) || 0;
      const nowI = ctx.i;
      const lfSec = lf > 1e12 ? lf / 1000 : lf; // ms -> seconds
      if (Math.abs(lfSec - nowT) < 6 * 4 * 3600) forcedRecent = true;
      else if (lf >= nowI - 6 && lf <= nowI) forcedRecent = true;
    } else if (ctx.state._forcedSeen == null) {
      ctx.state._forcedSeen = ctx.i;
    }
  }
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) {
    ctx.watch([]);
    return null;
  }

  // --- flat: two-sided mean reversion ---
  const uptrend = prevClose != null && prevClose > ema200;
  const downtrend = prevClose != null && prevClose < ema200;
  const longDip = uptrend && z <= -1.2;   // deep dip in an uptrend -> buy
  const shortExt = downtrend && z >= 1.2; // overextension in a downtrend -> short

  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'below', note: 'long dip', conds: [{ label: 'close>EMA200', ok: uptrend }, { label: 'z<', now: z, op: '<', ref: -1.2, closed: true }] },
    { side: 'sell', price: sma50, trigger: 'above', note: 'short ext', conds: [{ label: 'close<EMA200', ok: downtrend }, { label: 'z>', now: z, op: '>', ref: 1.2, closed: true }] }
  ]);

  if (!(longDip || shortExt)) return null;
  // risk 1.5% of cash per trade, stop 3xATR away; cap at 99% cash
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.015;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  ctx.state.entryBar = ctx.i;
  if (longDip) return { side: 'buy', qty };
  return { side: 'sell', qty };
}
