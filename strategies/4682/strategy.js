/*
 * @coinsori-strategy v1
 * name: SOL Mean Reversion 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated multi-asset MR basket (3133) buys oversold
 * bounces in uptrends and sells via an ATR-trailing stop. This applies the
 * same proven recipe to SOL 4h alone — a different family from the trend-
 * following turtle that is the current verified champion.
 * When it buys and sells: buy when a closed 4h bar closes below the lower
 * Bollinger (20,2.5) with RSI(14)<30, only inside a rising 200-SMA. Sell via
 * an ATR-trailing stop (2.5 ATR below the highest close since entry) or when
 * price closes back above the 20-day EMA.
 * When it does NOT work: in a broad bear market the rising-trend gate stays
 * flat (safe but no upside); a single straight-line melt-up of SOL still lags
 * buy-and-hold; the trail can whipsaw an early volatile recovery.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) return null;

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // ATR-trail anchored to the highest close since entry — proven on the MR basket
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail' },
               { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back' }]);
    return null;
  }

  if (!uptrend) return null;
  if (!(prevClose < lowerBand && rsi < 30)) return null;   // oversold flush in uptrend

  const qty = (ctx.cash / price) * 0.20;   // one leg, 20% of equity (basket sized ~20%/leg)
  if (qty <= 0) return null;
  ctx.state.peak = price;
  ctx.watch([{ side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush',
               conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true },
                       { label: '200-SMA rising', ok: uptrend, closed: true }] }]);
  return { side: 'buy', qty };
}
