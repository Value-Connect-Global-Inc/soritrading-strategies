/*
 * @coinsori-strategy v1
 * name: MultiAsset MR SlowExit 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same defensive mean-reversion basket as the validated champion, but on a
 * different axis — exit speed. The champion sells when price closes back above the fast 20-day
 * EMA, which can cut winners short during a strong recovery. This version keeps the position
 * until price closes above the slower 50-day EMA, letting a stronger bounce run further.
 * When it buys and sells: Buy an asset when RSI is flushed (BB lower + RSI<30, or Keltner low +
 * RSI<40) and its 200-day average is rising. Sell via ATR-trailing stop (2.5 ATR below peak) or
 * when price closes back above the 50-day EMA (slower than the champion's 20-day).
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat; a
 * single straight-line melt-up lags buy-and-hold; the slower exit gives back more profit on a
 * V-shaped dip-and-recover that stalls just below the 50-day EMA.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema50 == null || atr == null || atr <= 0) return null;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    if (price < trailStop || price > ema50) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) return null;

  const lowerBand = bb.lower;
  const keltnerLow = ema50 - 2.5 * atr;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
