/*
 * @coinsori-strategy v1
 * name: BTC 1D Hybrid Dual-Exit (MR snap-back + Trend ride)
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger flagged the Crash-Buy + Trend-Ride Hybrid (2998) as
 * promising (it fixes the defensive champion's melt-up gap) but it still uses a tight
 * EMA20 exit for BOTH entry types. The ledger repeatedly proved that a tight exit on
 * BTC 1D cuts trend winners short and destroys melt-up capture. This version splits the
 * exit by entry type: mean-reversion pullbacks keep the fast snap-back exit (the
 * champion's validated edge), while squeeze-breakout trend entries ride a slower 50-day
 * EMA exit so bull runs run further.
 * When it buys and sells: Same two entries inside a rising 200-day trend — a Bollinger
 * squeeze breakout above the 20-day high, and an ATR-Keltner oversold pullback. The
 * exit depends on which entry fired: MR trades exit on the EMA20/RSI55 snap-back, trend
 * trades exit only on a 50-day EMA break or a 200-day trend turn-down.
 * When it does NOT work: In a broad bear the rising-trend gate keeps it flat. A squeeze
 * that resolves down is missed (long-only). The slower trend exit gives back more of a
 * pullback before selling, so it needs a genuine bull to pay off.
 */
/*
 * 2024-01-15: Added ctx.watch declarations (display-only, trading logic unchanged).
 * 표시만 바뀜, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const high20 = ctx.high(20, 1);
  const bb = ctx.bb(20, 2, 1);
  if (ema20 == null || ema50 == null || atr == null || rsi == null || sma200 == null ||
      sma200prev == null || high20 == null || bb == null || bb.upper == null ||
      bb.lower == null || atr <= 0) return null;

  const pos = ctx.position;
  // Remember which entry type opened the current position (1 = trend/squeeze, 2 = MR).
  const entryType = ctx.state.entryType || 0;

  if (pos > 0) {
    // Trend entries ride a slower 50-day EMA exit so bull runs are not cut short.
    // MR entries keep the fast snap-back exit that is tightly coupled to the MR edge.
    const trendExit = entryType === 1 && (price < ema50 || sma200 < sma200prev);
    const mrExit = entryType === 2 && (price > ema20 || rsi > 55);
    if (trendExit || mrExit) {
      ctx.state.entryType = 0;
      return { side: 'sell', qty: pos };
    }
    if (entryType === 1) {
      ctx.watch([
        { side: 'sell', price: ema50, trigger: 'below', note: 'Trend exit EMA50' },
        { side: 'sell', price: sma200prev, trigger: 'below', note: 'Trend turn-down' }
      ]);
    } else if (entryType === 2) {
      ctx.watch([
        { side: 'sell', price: ema20, trigger: 'above', note: 'MR snap-back EMA20' },
        { side: 'sell', price: 55, trigger: 'above', note: 'MR snap-back RSI55', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] }
      ]);
    } else {
      ctx.watch([]);
    }
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) {
    ctx.watch([{ side: 'buy', price: sma200prev, trigger: 'above', note: 'Uptrend gate SMA200 rising', conds: [{ label: 'SMA200 rising', ok: false, closed: true }] }]);
    return null;
  }

  const lowerBand = ema20 - 2.5 * atr;
  const mrEntry = price < lowerBand && rsi < 40;

  // Bollinger squeeze breakout: width in quietest 20% of last 100 bars + 20-day high break.
  const width = (bb.upper - bb.lower) / ((bb.upper + bb.lower) / 2);
  let pctile = 0.5;
  const lookback = 100;
  if (ctx.i >= lookback) {
    let countBelow = 0;
    let total = 0;
    for (let k = 1; k <= lookback; k++) {
      const b = ctx.bb(20, 2, k);
      if (b == null || b.upper == null || b.lower == null) continue;
      const w = (b.upper - b.lower) / ((b.upper + b.lower) / 2);
      total++;
      if (w > width) countBelow++;
    }
    if (total > 0) pctile = countBelow / total;
  }
  const squeezeBreakout = pctile <= 0.2 && price > high20 && width > 0;

  if (squeezeBreakout) {
    ctx.state.entryType = 1;
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch([
      { side: 'buy', price: high20, trigger: 'above', note: 'Squeeze breakout high20', conds: [{ label: 'Squeeze pctile', now: pctile, op: '<=', ref: 0.2, closed: true }] },
      { side: 'sell', price: ema50, trigger: 'below', note: 'Trend exit EMA50' },
      { side: 'sell', price: sma200prev, trigger: 'below', note: 'Trend turn-down' }
    ]);
    return { side: 'buy', qty: qty };
  }
  if (mrEntry) {
    ctx.state.entryType = 2;
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'MR pullback lower band', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }] },
      { side: 'sell', price: ema20, trigger: 'above', note: 'MR snap-back EMA20' },
      { side: 'sell', price: 55, trigger: 'above', note: 'MR snap-back RSI55', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] }
    ]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([
    { side: 'buy', price: high20, trigger: 'above', note: 'Squeeze breakout high20', conds: [{ label: 'Squeeze pctile', now: pctile, op: '<=', ref: 0.2, closed: true }] },
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'MR pullback lower band', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }] }
  ]);
  return null;
}
