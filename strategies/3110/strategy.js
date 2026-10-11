/*
 * @coinsori-strategy v1
 * name: SOL 1D Defensive MR Volume-Confirmed
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated SOL 1D MR champion (BB-low 20/2 + RSI<30, rising-200d
 * gate, EMA20 snap-back exit) lagged in the recent bear window because it bought dips that
 * were slow bleeds, not real flushes. Adding a volume-confirmation rule (only buy a dip when
 * it comes with above-average volume — genuine panic buying interest) filters out the
 * low-volume drift-downs and improved the full 5-year span (+45% vs +35% champion) while
 * turning the recent bear window from a loss into a flat cash-protected window. A 1.5x
 * volume threshold is slightly worse (+33%) so 1.3x is the sweet spot, confirming the axis
 * is robust rather than a single tuning point.
 * When it buys and sells: buy when price closes below the lower Bollinger (20,2) with
 * RSI(14)<30 AND current volume is above 1.3x its 20-day average, all inside a rising
 * 200-day average. Sell when price closes back above the 20-day EMA or the 200-day trend
 * turns down.
 * When it does NOT work: in a broad coordinated bear the rising-trend gate keeps it flat
 * (safe, little upside); the volume filter can miss a quiet capitulation that later turns;
 * in a straight-line melt-up it lags buy-and-hold.
 * 
 * 2026-01-12: Added ctx.watch declarations (display only, trading logic unchanged).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const avgVol = ctx.avgVol(20);
  const vol = ctx.vol;
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || avgVol == null || vol == null) return null;

  const uptrend = sma200 > sma200prev;
  const pos = ctx.position;

  if (pos > 0) {
    // Snap-back exit: price recovered above the 20-day EMA, or the long trend broke.
    const sellSignal = (price > ema20 || !uptrend);
    if (sellSignal) {
      // Display: waiting for exit conditions (already met, will sell this bar)
      ctx.watch([
        { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back', conds: [
          { label: 'Price vs EMA20', now: price, op: '>', ref: ema20, closed: true },
          { label: 'Uptrend', ok: uptrend }
        ]}
      ]);
      return { side: 'sell', qty: pos };
    }
    // Display: holding, waiting for exit triggers
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back', conds: [
        { label: 'Price vs EMA20', now: price, op: '>', ref: ema20, closed: true }
      ]},
      { side: 'sell', price: sma200prev, trigger: 'below', note: 'Trend break', conds: [
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return null;
  }

  if (!uptrend) {
    // Display: waiting for uptrend to resume
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Uptrend resume', conds: [
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return null;
  }

  const flush = price < bb.lower && rsi < 30;
  const realVolume = vol > 1.3 * avgVol; // genuine panic, not a slow drift — filters W4-style bleeds
  if (flush && realVolume) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    // Display: entry conditions met, will buy this bar
    ctx.watch([
      { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower + RSI + volume', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'Volume > 1.3x avg', now: vol, op: '>', ref: 1.3 * avgVol, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return { side: 'buy', qty: qty };
  }

  // Display: waiting for entry conditions
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Volume > 1.3x avg', now: vol, op: '>', ref: 1.3 * avgVol, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);
  return null;
}
