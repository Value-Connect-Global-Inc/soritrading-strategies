/*
 * @coinsori-strategy v1
 * name: SOL Funding-Fade Pullback 4H
 * ex: binanceusdm
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same framework as the validated BTC+ETH funding-fade winners —
 * a pure out-of-sample generalization to SOL. Perpetual funding reveals how crowded
 * the long side is; we fade extreme funding but only with a price trigger and a trend
 * filter. SOL funding swings are the most extreme of the majors, which is exactly the
 * regime this fade targets.
 * When it buys and sells: BUY a pullback to the 20-SMA when funding is in the bottom
 * 20% of its recent range and price is above the 100-SMA; SELL a bounce to the 20-SMA
 * when funding is in the top 20% and price is below the 100-SMA. Exit when price
 * returns to the 20-SMA or a 2.5x ATR hard stop is hit.
 * When it does NOT work: SOL funding can stay extreme for long stretches and SOL is
 * more volatile than BTC/ETH, so the hard stop gets hit more often; in strong one-way
 * moves the contrarian side bleeds small losses.
 */
function onUpdate(ctx) {
  // ---- funding percentile (small rolling buffer to keep ctx.state cheap) ----
  const fRaw = ctx.funding;
  if (fRaw != null) ctx.state.lastFunding = fRaw;   // keep last known funding across bars
  const f = ctx.state.lastFunding;
  if (f == null) return null;                       // no funding seen yet

  const hist = ctx.state.fundingHist || [];
  hist.push(f);
  if (hist.length > 80) hist.shift();
  ctx.state.fundingHist = hist;

  const N = 60;
  if (hist.length < N) return null;                 // need 60 funding readings

  const win = hist.slice(-N);
  let below = 0;
  for (let k = 0; k < N; k++) if (win[k] <= f) below++;
  const pct = below / N;                            // 0..1 percentile of current funding

  // ---- closed-bar indicators ----
  const sma20 = ctx.sma(20, 1);
  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma20 == null || sma100 == null || atr == null) return null;

  const prevClose = ctx.closes.at(-2);              // last closed bar
  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const stopDist = 2.5 * atr;                       // hard stop distance

  // ---- exits (price-based, so they are declarable) ----
  if (pos > 0) {
    const stop = (entry == null ? price : entry) - stopDist;
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'MR back to SMA20' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    if (price >= sma20 || price <= stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    const stop = (entry == null ? price : entry) + stopDist;
    ctx.watch([
      { side: 'buy', price: sma20, trigger: 'below', note: 'MR back to SMA20' },
      { side: 'buy', price: stop, trigger: 'above', note: 'hard stop' }
    ]);
    if (price <= sma20 || price >= stop) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // ---- no new entries while the engine is forcing closes / restarting ----
  // (lifecycle L5/L6: after a forced close the edge is reduce-only; a fresh entry
  //  right then is what the harness flags as a spurious closing-direction order)
  if (ctx.alloc && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }

  // ---- entries: risk 2% of cash per trade over the stop distance ----
  const qty = (ctx.cash * 0.02) / stopDist;

  if (pct < 0.20 && prevClose > sma100 && price <= sma20) {
    // shorts crowded + uptrend + pullback to fast MA -> buy the dip
    ctx.watch([{ side: 'buy', price: sma20, trigger: 'below', note: 'dip to SMA20',
      conds: [{ label: 'funding pct', now: pct, op: '<', ref: 0.2, closed: true },
              { label: 'above SMA100', ok: prevClose > sma100 }] }]);
    return { side: 'buy', qty };
  }
  if (pct > 0.80 && prevClose < sma100 && price >= sma20) {
    // longs crowded + downtrend + bounce to fast MA -> sell the bounce
    ctx.watch([{ side: 'sell', price: sma20, trigger: 'above', note: 'bounce to SMA20',
      conds: [{ label: 'funding pct', now: pct, op: '>', ref: 0.8, closed: true },
              { label: 'below SMA100', ok: prevClose < sma100 }] }]);
    return { side: 'sell', qty };
  }

  ctx.watch([]);
  return null;
}
