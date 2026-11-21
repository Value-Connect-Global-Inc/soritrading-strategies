/*
 * @coinsori-strategy v1
 * name: BTC Dip-Buy Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Different family from the trend favorite: instead of riding trends it
 * buys sharp pullbacks inside an established uptrend and sells the bounce
 * back to the mean. When it buys and sells: BUY when price is still above
 * the 200-EMA (uptrend) but has fallen ~1 std dev below its 50-bar mean
 * with RSI oversold (crowd fear). SELL when price recovers to the mean,
 * the 3xATR hard stop is hit, the 200-EMA flips down, or 24 bars pass.
 * It sits in cash most of the time and only trades the dips.
 * When it does NOT work: in a strong one-way bull it misses most of the
 * rise (few deep dips); in a slow grinding bear it still gets stopped out
 * on bounces before the EMA200 filter turns off.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const sma50 = ctx.sma(50, 1);
  const sd50 = ctx.stdev(50, 1);
  const z = ctx.zscore(50, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || sma50 == null || sd50 == null || z == null || rsi == null || atr == null) {
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
      ? ctx.times[entryBar] + 24 * 4 * 3600
      : null; // 24 bars = 4 days of 4h bars, dead-money guard
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

  // --- entry: dip inside an uptrend only (avoid catching bear-market knives) ---
  const uptrend = prevClose != null && prevClose > ema200;
  const oversold = z <= -1.0 && rsi < 40; // ~1 std dev below the 50-bar mean AND RSI fear
  const entryLevel = sma50 - 1.0 * sd50;

  ctx.watch([
    { side: 'buy', price: entryLevel, trigger: 'below', note: 'dip buy', conds: [
      { label: 'close>EMA200', ok: uptrend },
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }
    ]}
  ]);

  if (!(uptrend && oversold)) return null;
  let qty = (ctx.cash * 0.6) / price; // counter-trend: smaller size than the trend strategy's 0.95
  if (qty <= 0) return null;
  ctx.state.entryBar = ctx.i;
  return { side: 'buy', qty };
}
