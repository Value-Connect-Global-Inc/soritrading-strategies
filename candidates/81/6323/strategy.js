/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Dip Buy 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crowded fear marks short-term bottoms in crypto. When the Fear & Greed index drops far below its own recent average AND price makes a fresh 20-bar low, the crowd is selling into a dip that usually bounces.
 * When it buys and sells: buys when Fear & Greed is more than 1 standard deviation below its 60-day average and the last closed price closes below its prior 20-bar low; sells when price recovers above its 20-bar average, or hits a 2.5xATR stop, or after 40 days.
 * When it does NOT work: in a long bear market fear stays extreme while price keeps falling — the stop-loss is hit repeatedly and small bounce profits cannot cover them; that is the losing regime.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const fg = ctx.data("fear_greed");
  const atr = ctx.atr(14, 1);
  if (fg == null || atr == null) return null;

  // rolling mean/std of Fear & Greed over ~60 days (360 4h bars; the index updates daily so 6 bars share one value)
  let buf = ctx.state.fgBuf || [];
  buf.push(fg);
  if (buf.length > 360) buf = buf.slice(-360);
  ctx.state.fgBuf = buf;
  if (buf.length < 90) return null; // need ~15 days of sentiment history before trading

  let mean = 0;
  for (const v of buf) mean += v;
  mean /= buf.length;
  let sd = 0;
  for (const v of buf) sd += (v - mean) * (v - mean);
  sd = Math.sqrt(sd / buf.length);
  const z = sd > 0.0001 ? (fg - mean) / sd : 0;

  if (ctx.position <= 0) {
    const low20 = ctx.low(20, 2); // low of the 20 bars BEFORE the last closed bar
    if (low20 == null) return null;
    const fearSpike = z <= -1.0; // fear far below its recent average = contrarian buy zone
    const freshLow = prevClose < low20; // price still making new lows into the fear
    // cooldown: skip 15 bars (2.5 days) after a stop-loss so a crash does not trigger repeated knife catches
    const cooldown = ctx.state.lastStopBar != null && ctx.i - ctx.state.lastStopBar < 15;
    ctx.watch([{ side: 'buy', price: low20, trigger: 'below', note: 'dip in extreme fear', conds: [{ label: 'F&G z-score', now: z, op: '<=', ref: -1.0, closed: true }] }]);
    if (fearSpike && freshLow && !cooldown) {
      // risk 3% of cash on a 2.5xATR stop so a failed catch costs ~3%, not the account
      const stopDist = 2.5 * atr;
      const qty = (ctx.cash * 0.03) / stopDist;
      const cap = (ctx.cash / ctx.price) * 0.98;
      ctx.state.held = 0;
      return { side: 'buy', qty: Math.min(qty, cap) };
    }
    return null;
  }

  const entry = ctx.entryPx;
  if (entry == null) { ctx.watch([]); return null; }

  const held = (ctx.state.held || 0) + 1;
  ctx.state.held = held;

  const stopPx = entry - 2.5 * atr; // hard stop: a real failure costs ~3%
  const sma20 = ctx.sma(20, 1);
  const recovery = sma20 != null && prevClose >= sma20; // bounce back above the 20-bar average = dip bought
  const maxHold = held >= 240; // 40 days: do not sit in a trade that never bounces
  const nextExitEpoch = ctx.times.at(-1) + 240 * 4 * 3600;

  ctx.watch([
    { side: 'sell', price: stopPx, trigger: 'below', note: 'stop loss' },
    { side: 'sell', price: sma20 != null ? sma20 : 0, trigger: 'above', note: 'recovery' },
    { side: 'sell', at: nextExitEpoch, note: 'max hold 40d' }
  ]);

  if (prevClose <= stopPx) {
    ctx.state.lastStopBar = ctx.i;
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (recovery || maxHold) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
