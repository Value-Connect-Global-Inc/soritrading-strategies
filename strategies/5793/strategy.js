/*
 * @coinsori-strategy v1
 * name: MultiAsset MR Basket ConstTrail 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Validated 5-asset defensive mean-reversion basket with a scaled exit,
 * but keeping ONE constant 2.5-ATR trail for the whole position instead of tightening to
 * 1.5 ATR after the half-sale. Cycle 34 showed tightening the trail hurts; this tests
 * whether removing the post-half-sale tightening entirely lets winners run further.
 * When it buys and sells: Buys a dip on each asset when price closes below the lower
 * Bollinger (20,2.5) with RSI<30, or below the ATR-adaptive Keltner low with RSI<40, only
 * while the 200-day average is rising. Sells half at entry + 1.5*ATR, then the rest on a
 * constant 2.5-ATR trail or when price closes above the 20-day EMA.
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
    const entry = ctx.entryPx;
    const halfSold = ctx.state.halfSold === true;
    const trailMult = 2.5;   // constant trail — no tightening after the half-sale
    const trailStop = peak - trailMult * atr;
    const profitTarget = entry != null && entry > 0 ? entry + 1.5 * atr : null;

    const watchList = [{ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
                      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' }];
    if (!halfSold && profitTarget != null) {
      watchList.push({ side: 'sell', price: profitTarget, trigger: 'above', note: 'half profit target' });
    }
    ctx.watch(watchList);

    if (!halfSold && profitTarget != null && price >= profitTarget) {
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

  if (uptrend) {
    ctx.watch([{ side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30' },
              { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40' }]);
  }

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
