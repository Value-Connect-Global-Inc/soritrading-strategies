/*
 * @coinsori-strategy v1
 * name: BTC/ETH/SOL/XRP/BNB Regime-Gated Momentum 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Pure cross-sectional momentum fails because it is always
 * fully invested in the most volatile coins and rides them down in a broad
 * crash. This version keeps the relative-strength edge (hold the strongest
 * coins) but adds a market-regime gate: it only holds the top coins while
 * Bitcoin itself is in a long-term uptrend (above its 200-bar average). When
 * BTC breaks below its trend, the whole basket steps to cash, protecting the
 * account from the broad selloff that pure rotation could not dodge.
 * When it buys and sells: Each symbol runs its own instance. It computes each
 * coin's trailing momentum (return over ~120 4h bars = 20 days). If BTC is
 * above its 200-bar trend AND this coin ranks in the top 2 by momentum, it is
 * held long. If BTC is below its trend, every position is closed to cash.
 * When it does NOT work: in a bear market that starts with a sharp single-bar
 * crash faster than the 200-bar trend can flip (the gate lags the top), and in
 * a choppy sideways regime where BTC oscillates around its 200-bar average,
 * causing the gate to flip on and off frequently.
 */
function onUpdate(ctx) {
  const syms = ctx.syms || [];
  const mySym = ctx.sym;
  if (syms.length < 2 || !mySym) { ctx.watch([]); return null; }

  // find the BTC symbol whatever format ctx.syms uses
  const btcSym = syms.find((s) => String(s).toUpperCase().indexOf('BTC') === 0) || null;

  // accumulate per-symbol close history (dedup by bar time, shared ctx.state)
  const t = ctx.times.length ? ctx.times[ctx.times.length - 1] : ctx.i;
  const hist = ctx.state.hist || {};
  for (const s of syms) {
    const m = ctx.market(s);
    if (!m) continue;
    let px = null;
    if (typeof m.price === 'number') px = m.price;
    else if (typeof m.close === 'number') px = m.close;
    else if (Array.isArray(m.closes) && m.closes.length) px = m.closes[m.closes.length - 1];
    if (px == null || px <= 0) continue;
    const arr = hist[s] || [];
    if (arr.length === 0 || arr[arr.length - 1].t !== t) {
      arr.push({ t: t, px: px });
      if (arr.length > 210) arr.shift();
      hist[s] = arr;
    }
  }
  ctx.state.hist = hist;

  // market-regime gate: BTC above its 200-bar average (long-term uptrend)
  let regimeOn = false;
  if (btcSym) {
    const btc = hist[btcSym];
    if (btc && btc.length >= 201) {
      const btcNow = btc[btc.length - 1].px;
      let sum = 0;
      for (let i = btc.length - 200; i < btc.length; i++) sum += btc[i].px;
      regimeOn = btcNow > sum / 200;
    }
  }
  if (!regimeOn) {
    // gate off: close any position to cash
    const pos = ctx.position || 0;
    if (pos !== 0) {
      ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'below', note: 'regime off -> cash' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'above', note: 'wait regime on' }]);
    return null;
  }

  // compute each symbol's trailing momentum (return over last ~120 bars = 20 days)
  const mom = [];
  for (const s of syms) {
    const arr = hist[s];
    if (!arr || arr.length < 121) continue;
    const now = arr[arr.length - 1].px;
    const past = arr[arr.length - 121].px;
    if (past <= 0) continue;
    mom.push({ sym: s, ret: (now - past) / past, price: now });
  }
  if (mom.length < 2) { ctx.watch([]); return null; }

  // rank by momentum, find my rank
  mom.sort((a, b) => b.ret - a.ret);
  const myRank = mom.findIndex((x) => x.sym === mySym);
  if (myRank < 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const hold = myRank < 2; // hold if in top 2 by momentum

  const conds = [{ label: 'mom rank', now: myRank, op: '<', ref: 2, closed: true }];
  const watch = [];
  if (pos !== 0) {
    watch.push({ side: 'sell', price: ctx.price, trigger: 'below', note: 'rotation exit', conds: conds });
  } else {
    watch.push({ side: 'buy', price: ctx.price, trigger: 'above', note: 'top-2 momentum entry', conds: conds });
  }
  ctx.watch(watch);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  // exit: held but no longer top-2
  if (pos !== 0 && !hold) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }

  // entry: flat and in top-2
  if (pos === 0 && hold) {
    const qty = (ctx.cash * 0.9) / ctx.price;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
