/*
 * @coinsori-strategy v1
 * name: AVAX 1D Defensive MR Single-Leg Test
 * ex: binance
 * syms: AVAXUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로.
 *
 * Why this strategy: The validated defensive MR recipe (Bollinger/Keltner flush buy in a
 * rising 200-SMA, EMA20 snap-back exit) works on BTC/ETH/SOL/XRP/BNB/ADA/LTC. This tests
 * whether AVAX responds to the same recipe as a candidate 8th basket leg.
 * When it buys and sells: Buy when price closes below the lower Bollinger (20,2.5) with
 * RSI<30, or below the ATR-adaptive Keltner low with RSI<40, only in a rising 200-day
 * average. Sell when price closes back above the 20-day EMA, or drops 2.5 ATR from the
 * highest close since entry.
 * When it does NOT work: In a straight-line melt-up it lags buy-and-hold; in a coordinated
 * bear it stays flat.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  if (pos > 0) {
    const entry = ctx.state.high ? Math.max(ctx.state.high, price) : price;
    ctx.state.high = entry;
    const trailStop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back exit' },
      { side: 'sell', price: trailStop, trigger: 'below', note: 'trail stop 2.5 ATR' }
    ]);
    if (price > ema20 || price < trailStop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  ctx.watch([
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'BB lower flush',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]
    },
    {
      side: 'buy',
      price: keltnerLow,
      trigger: 'below',
      note: 'Keltner low pullback',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]
    }
  ]);

  if (bollingerFlush || keltnerPullback) {
    const legCash = ctx.cash;
    const riskEq = 0.01 * legCash;
    const qty = riskEq / atr;
    const maxQty = (legCash / price) * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
