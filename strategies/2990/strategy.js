/*
 * @coinsori-strategy v1
 * name: BTC 1D Hybrid MR + Squeeze Breakout
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: This combines my two validated edges on BTC 1D. The mean-reversion
 * family buys pullbacks (defensive, works in chop) and the volatility-squeeze breakout buys
 * expansions (captures bull moves). Inside a single rising 200-day trend gate, it takes BOTH
 * entries: a squeeze breakout (price closes above the 20-day high while Bollinger width is
 * compressed) and a mean-reversion pullback (price closes below the ATR-adaptive lower
 * Keltner band with RSI < 40). This captures more of a bull than either family alone while
 * the trend gate keeps us out of bear false moves.
 * When it buys and sells: Buy when the 200-day average is rising AND either (a) price closes
 * above the 20-day high during a Bollinger squeeze, or (b) price dips below the lower Keltner
 * band with weak RSI. Sell when price closes back below the 20-day EMA or the 200-day trend
 * turns down.
 * When it does NOT work: In a broad bear the rising-trend gate keeps us flat (capital-safe
 * but little upside). A squeeze that resolves DOWN is missed (long-only). It can whipsaw in
 * a flat, tight range where the squeeze fires then immediately reverses.
 */
// 2026-04-08 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const high20 = ctx.high(20, 1);
  const bb = ctx.bb(20, 2, 1);
  if (ema20 == null || atr == null || rsi == null || sma200 == null || sma200prev == null ||
      high20 == null || bb == null || bb.upper == null || bb.lower == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    const exitWatch = [
      { side: 'sell', price: ema20, trigger: 'below', note: 'Exit below EMA20' },
      { side: 'sell', note: 'SMA200 turning down', conds: [{ label: 'SMA200 falling', now: sma200, op: '<', ref: sma200prev, closed: true }] }
    ];
    ctx.watch(exitWatch);

    // Exit below the 20-day EMA or when the long-term trend turns down.
    if (price < ema20 || sma200 < sma200prev) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Only trade inside a rising long-term trend (the shared defensive gate).
  const uptrend = sma200 > sma200prev;
  if (!uptrend) {
    ctx.watch([
      { side: 'buy', note: 'Waiting for uptrend', conds: [{ label: 'SMA200 rising', now: sma200, op: '>', ref: sma200prev, closed: true }] }
    ]);
    return null;
  }

  // Mean-reversion pullback entry: price under the ATR-adaptive lower Keltner band + weak RSI.
  const lowerBand = ema20 - 2.5 * atr;
  const mrEntry = price < lowerBand && rsi < 40;

  // Squeeze-breakout entry: Bollinger width in quietest 20% of last 100 bars + 20-day high break.
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

  const entryWatch = [
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'MR pullback',
      conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'SMA200 rising', now: sma200, op: '>', ref: sma200prev, closed: true }
      ]
    },
    {
      side: 'buy',
      price: high20,
      trigger: 'above',
      note: 'Squeeze breakout',
      conds: [
        { label: 'BB width pctile', now: pctile, op: '<=', ref: 0.2, closed: true },
        { label: 'BB width > 0', now: width, op: '>', ref: 0, closed: true },
        { label: 'SMA200 rising', now: sma200, op: '>', ref: sma200prev, closed: true }
      ]
    }
  ];
  ctx.watch(entryWatch);

  if (mrEntry || squeezeBreakout) {
    const equity = ctx.cash + ctx.uPnl;
    const qty = (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash) / price;
    return { side: 'buy', qty: qty * 0.98 };
  }
  return null;
}
