/*
 * @coinsori-strategy v1
 * name: MultiAsset MR Basket ScaledExit 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same validated 5-asset defensive mean-reversion basket, but with a
 * scaled exit: bank half the position at a 1.5-ATR profit target to lock gains and cut
 * drawdown, and let the other half keep riding the ATR-trailing stop. The champion's fast
 * EMA20 exit already works, so the question is whether locking half a win early reduces
 * max drawdown without giving up too much upside.
 * When it buys and sells: Buys a dip on each asset when price closes below the lower
 * Bollinger (20,2.5) with RSI<30, or below the ATR-adaptive Keltner low with RSI<40, only
 * while the 200-day average is rising. Sells half at entry + 1.5*ATR, then the rest on the
 * ATR-trail (2.5 ATR below peak) or when price closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay
 * flat; in a straight-line melt-up the half-exit caps the winner below buy-and-hold.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) return null;

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;

    // Partial profit: bank half when up 1.5 ATR from entry (a solid MR recovery), keep the rest on the trail.
    const entry = ctx.entryPx;
    const halfSold = ctx.state.halfSold === true;
    if (!halfSold && entry != null && entry > 0 && price >= entry + 1.5 * atr) {
      ctx.state.halfSold = true;
      const halfQty = pos / 2;
      if (halfQty > 0) return { side: 'sell', qty: halfQty, reduceOnly: true };
    }

    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      ctx.state.halfSold = false;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (!uptrend) return null;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  return null;
}
