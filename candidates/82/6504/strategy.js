/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Perpetual funding shows where the crowd is positioned.
 * Deeply negative funding means shorts pay longs — the crowd is crowded
 * short, and those shorts get squeezed, which historically marks local
 * bottoms. This buys weakness, not strength: a different source of return
 * than a trend follower.
 * When it buys and sells: Buy when funding falls more than 2 standard
 * deviations below its own 16-day average AND price is below its 16-day
 * average (a real pullback that produced the crowded shorts). Sell when
 * funding normalizes back to average, or at a 12% take-profit / 8% stop.
 * When it does NOT work: In a calm persistent bull, funding rarely turns
 * deeply negative, so it stays flat and misses the rally. In a real crash
 * funding stays negative while price keeps falling — the hard stop caps the
 * loss but entries can be early.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const f = ctx.funding;
  if (f == null || !isFinite(f)) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;

  // Rolling funding history (funding settles every 8h = every 2 bars on 4h).
  let hist = ctx.state.fundHist;
  if (!Array.isArray(hist)) hist = [];
  hist.push(f);
  if (hist.length > 96) hist = hist.slice(-96);
  ctx.state.fundHist = hist;

  // Need ~8 days of funding before the mean/std is meaningful.
  if (hist.length < 48) { ctx.watch([]); return null; }

  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
  const z = sd > 0 ? (f - mean) / sd : 0;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const tp = entry != null ? entry * 1.12 : null;   // 12% squeeze target
    const stop = entry != null ? entry * 0.92 : null; // 8% hard stop, caps crash risk
    ctx.watch([
      { side: 'sell', price: tp, trigger: 'above', note: 'take profit' },
      { side: 'sell', price: stop, trigger: 'below', note: 'hard stop' }
    ]);
    // Exit when funding normalizes (positioning edge gone) or price hits TP/stop.
    if ((tp != null && prevClose >= tp) || (stop != null && prevClose <= stop) || z > 0.5) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  const sma96 = ctx.sma(96, 1);
  if (sma96 == null) { ctx.watch([]); return null; }

  const pullback = prevClose < sma96;
  const crowdedShorts = z < -2.0;

  ctx.watch([{
    side: 'buy', price: sma96, trigger: 'below', note: 'dip + crowded shorts',
    conds: [
      { label: 'funding z', now: z, op: '<', ref: -2, closed: true },
      { label: 'close < sma96', ok: pullback }
    ]
  }]);
  if (crowdedShorts && pullback) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
