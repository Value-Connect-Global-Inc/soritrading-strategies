/*
 * @coinsori-strategy v1
 * name: BTC 1D Hybrid Dual-Exit + Tighter Hard Stop
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 3.5*ATR hard stop added to Dual-Exit (3013) was a complete
 * no-op — results were byte-identical, meaning the slow EMA50 exit always fires before
 * a 3.5*ATR drop. The real MDD source in the weak 2024-26 window is whipsaw: the trend
 * entry rides back down in choppy markets. This version tightens the hard stop to
 * 2.2*ATR below entry so a trend trade that reverses hard is cut before the slow exit
 * gives back the whole move, targeting the W3 MDD33 weakness.
 * When it buys and sells: Same two entries inside a rising 200-day trend — a Bollinger
 * squeeze breakout above the 20-day high, and an ATR-Keltner oversold pullback. MR
 * trades exit on the EMA20/RSI55 snap-back; trend trades exit on a 50-day EMA break, a
 * 200-day trend turn-down, OR a hard 2.2*ATR stop below entry (whichever first).
 * When it does NOT work: In a broad bear the rising-trend gate keeps it flat. A squeeze
 * that resolves down is missed (long-only). A tighter stop can be tripped by a normal
 * volatile shakeout before the trend resumes, costing a loss the slow exit would have
 * ridden through — this is the trade-off being tested.
 *
 * 2026-05-07: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

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
      bb.lower == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const entryType = ctx.state.entryType || 0;

  if (pos > 0) {
    const entryPx = ctx.entryPx && ctx.entryPx > 0 ? ctx.entryPx : price;
    // Tighter 2.2*ATR hard stop on trend entries to cut whipsaw drawdown in the weak
    // 2024-26 window (the 3.5*ATR version was a no-op because EMA50 always fired first).
    const hardStop = entryType === 1 && (entryPx - price) > 2.2 * atr;
    const trendExit = entryType === 1 && (price < ema50 || sma200 < sma200prev);
    const mrExit = entryType === 2 && (price > ema20 || rsi > 55);

    if (entryType === 1) {
      ctx.watch([
        { side: 'sell', price: ema50, trigger: 'below', note: 'EMA50 break' },
        { side: 'sell', price: entryPx - 2.2 * atr, trigger: 'below', note: '2.2*ATR hard stop' },
        { side: 'sell', note: 'SMA200 turn-down', conds: [{ label: 'SMA200 falling', ok: sma200 < sma200prev }] }
      ]);
    } else if (entryType === 2) {
      ctx.watch([
        { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' },
        { side: 'sell', note: 'RSI overbought', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 55, closed: true }] }
      ]);
    } else {
      ctx.watch([]);
    }

    if (hardStop || trendExit || mrExit) {
      ctx.state.entryType = 0;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const lowerBand = ema20 - 2.5 * atr;
  const mrEntry = price < lowerBand && rsi < 40;

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

  ctx.watch([
    {
      side: 'buy',
      price: high20,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [
        { label: 'BB width pctile', now: pctile, op: '<=', ref: 0.2, closed: true },
        { label: 'BB width > 0', ok: width > 0 },
        { label: 'SMA200 rising', ok: uptrend }
      ]
    },
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'MR pullback',
      conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]
    }
  ]);

  if (squeezeBreakout) {
    ctx.state.entryType = 1;
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty: qty };
  }
  if (mrEntry) {
    ctx.state.entryType = 2;
    const qty = (ctx.cash / price) * 0.98;
    return { side: 'buy', qty: qty };
  }
  return null;
}
