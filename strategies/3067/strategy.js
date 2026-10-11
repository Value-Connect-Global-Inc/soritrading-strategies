/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive MR Basket 5-Asset Level-Gate
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-asset defensive MR basket is the validated champion, but its
 * per-asset gate requires a RISING 200-day average, which blocks buys in sideways chop
 * where price sits above a flat 200-day line. This version keeps the same defensive MR
 * recipe but switches the gate to "price above the 200-day average" (a level check, not a
 * slope check) so it can buy oversold flushes in sideways/early-recovery regimes too, while
 * still refusing to catch falling knives in a deep bear. Exit stays the ATR-trailing stop
 * plus the EMA20 snap-back.
 * When it buys and sells: On each asset, buy when price closes below the lower Bollinger
 * (20,2.5) with RSI<30, or below the ATR-adaptive Keltner low (EMA20-2.5*ATR) with RSI<40,
 * but only while price is above the 200-day average. Sell via a 2.5-ATR trailing stop below
 * the highest close since entry, or when price closes back above the 20-day EMA.
 * When it does NOT work: If the 200-day average is falling steeply, price quickly drops
 * below it and the gate turns off (safe, but no upside). A single straight-line melt-up of
 * one asset still lags buy-and-hold of that asset. The looser level gate can occasionally
 * buy a flush that keeps sliding in a mild downtrend.
 *
 * 2024-01-15: Added ctx.watch declarations — display only; trading logic unchanged.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || ema20 == null || atr == null || atr <= 0) return null;

  // Defensive gate: only mean-revert while price holds above the long-term average.
  // Level check (not slope) so sideways chop above the 200d still allows MR buys.
  const above200 = price > sma200;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr; // 2.5 ATR below the peak = let winners run, cut reversals

    // Declare exit waits: trailing stop and EMA20 snap-back
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: '2.5 ATR trail stop' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' }
    ]);

    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!above200) {
    // Not above 200d — declare we're waiting for price to rise above it
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: '200d gate' }
    ]);
    return null;
  }

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  // Declare entry waits with the exact values used in the decision
  ctx.watch([
    {
      side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }
      ]
    },
    {
      side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }
      ]
    }
  ]);

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    // 2.5% of equity risked per leg, inverse-ATR sized, capped at the 20% leg share.
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
