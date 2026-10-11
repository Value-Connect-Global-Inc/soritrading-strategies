/*
 * @coinsori-strategy v1
 * name: Upbit BTC 1D Defensive MR v2
 * ex: upbit
 * syms: BTC
 * interval: 1d
 * cash: 10000000
 *
 * Why this strategy: The ledger's validated defensive edge is buying sharp pullbacks inside
 * an uptrend and riding the snap-back with a tight trailing stop. v1 on upbit BTC 1d was too
 * strict (only Bollinger-low + RSI<30) and fired too rarely on the short 786-bar history.
 * This v2 adds the champion's second entry path (Keltner pullback) and lowers the trend gate
 * to 100 bars so it fits the available ~2 years of data while keeping the same defensive exit.
 * When it buys and sells: buy when price closes below the lower Bollinger (20,2.5) with
 * RSI<30, OR below the Keltner low (EMA20 - 2.5*ATR) with RSI<40, while the 100-day average
 * is rising; exit when price closes back above the 20-day EMA or on a 2.5x ATR trailing stop.
 * When it does NOT work: in a broad bear the rising-trend gate keeps it flat (capital safe,
 * little upside); in a straight-line melt-up it lags holding BTC outright. Only ~2 years of
 * upbit data, so it has not been tested through a full bear cycle.
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma100 = ctx.sma(100, 1);
  const sma100prev = ctx.sma(100, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma100 == null || sma100prev == null || ema20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma100 > sma100prev;
  const pos = ctx.pos('BTC');

  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;

    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: '20EMA exit' },
      { side: 'sell', price: trailStop, trigger: 'below', note: '2.5 ATR trail' }
    ]);

    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr;
  const bollingerFlush = price < bb.lower && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;
  if (!(bollingerFlush || keltnerPullback)) {
    ctx.watch([
      {
        side: 'buy',
        price: bb.lower,
        trigger: 'below',
        note: 'BB lower flush',
        conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }]
      },
      {
        side: 'buy',
        price: keltnerLow,
        trigger: 'below',
        note: 'Keltner pullback',
        conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }]
      }
    ]);
    return null;
  }

  const riskBudget = 0.015 * ctx.cash;
  let qty = riskBudget / atr;
  const maxQty = (ctx.cash / price) * 0.95;
  qty = Math.min(qty, maxQty);
  if (qty <= 0) {
    ctx.watch([]);
    return null;
  }
  ctx.state.peak = price;
  ctx.watch([]);
  return { side: 'buy', qty: qty };
}
