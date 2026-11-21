/*
 * @coinsori-strategy v1
 * name: BTC Funding-Squeeze Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In crypto perpetuals, extreme negative funding means the
 * crowd is heavily short. When shorts are crowded and price is in a confirmed
 * uptrend, forced buybacks (a short squeeze) tend to push price higher. We buy
 * those squeezes and ride them until price momentum fades.
 * When it buys and sells: Buy when funding is unusually negative (z-score
 * below -1.5 and funding itself negative) while price is above BOTH the 50-
 * and 200-period averages (confirmed uptrend, not a dead-cat bounce). Sell
 * when price falls back from its peak since entry by 5x ATR, or when it
 * breaks the 200-period average. Wait 48 bars (8 days) after an exit.
 * When it does NOT work: In a long calm bull with no funding extremes it
 * trades rarely and earns little. If an uptrend breaks right after entry, the
 * stop-loss takes the loss. In a choppy market the trailing stop whipsaws.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || atr == null) { ctx.watch([]); return null; }

  const st = ctx.state;
  if (st.hist == null) st.hist = [];
  const funding = ctx.funding;
  let fz = null;
  if (funding != null) {
    if (st.hist.length >= 60) {
      let s = 0;
      for (const v of st.hist) s += v;
      const m = s / st.hist.length;
      let ss = 0;
      for (const v of st.hist) ss += (v - m) * (v - m);
      const sd = Math.sqrt(ss / st.hist.length);
      if (sd > 0) fz = (funding - m) / sd;
    }
    st.hist.push(funding);
    if (st.hist.length > 200) st.hist.shift();
  }

  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    // Track the highest close since entry (survives restarts via ctx.state).
    if (st.peak == null) st.peak = entryPx != null ? entryPx : prevClose;
    if (prevClose > st.peak) st.peak = prevClose;
    // 5x ATR chandelier trail: wide enough to survive squeeze noise.
    const trail = st.peak - 5 * atr;
    const trendBreak = prevClose < ema200;
    const watch = [
      { side: 'sell', price: trail, trigger: 'below', note: '5x ATR trail' },
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend break' }
    ];
    ctx.watch(watch);
    if (trendBreak || prevClose < trail) {
      st.cooldown = ctx.i + 48; // 8 days before re-entering
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }
  if (st.cooldown != null && ctx.i < st.cooldown) { ctx.watch([]); return null; }

  // Confirmed uptrend: price above BOTH the 50- and 200-period averages.
  const trendUp = prevClose > ema200 && prevClose > ema50;
  const squeeze = fz != null && funding != null && funding < 0 && fz < -1.5;
  const buyWatch = { side: 'buy', price: ema200, trigger: 'above', note: 'deep squeeze + uptrend' };
  if (fz != null) buyWatch.conds = [{ label: 'funding z (60h)', now: fz, op: '<', ref: -1.5 }];
  ctx.watch([buyWatch]);
  if (trendUp && squeeze) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
