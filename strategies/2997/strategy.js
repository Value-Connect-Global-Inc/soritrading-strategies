/*
 * @coinsori-strategy v1
 * name: BTC 1D Dual-MR Defensive (Bollinger+Keltner)
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger is unambiguous — on BTC 1D every trend-following and
 * trend-capture family fails, while defensive mean-reversion is the only validated edge.
 * This strategy combines my two independently-validated MR signals (Bollinger-RSI flush
 * and ATR-adaptive Keltner pullback) into one defensive core, still gated by a rising
 * 200-day trend so we never catch a falling knife in a broad bear. It trades rarely.
 * When it buys and sells: Buy when price closes below the lower Bollinger band (20,2.5)
 * with RSI<30, OR below the ATR-adaptive lower Keltner band with RSI<40, all only inside a
 * rising 200-day average. Size by ATR risk (1% equity) capped at 90% cash. Sell on the
 * snap-back above the 20-day EMA or when RSI climbs above 55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps us flat
 * (capital-safe but little upside), and it lags buy-and-hold in a relentless melt-up.
 * Low trade count means the edge depends on the few flushes that mark a local bottom.
 * 
 * 2026-01-20: Added ctx.watch declarations only — display changes, trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
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

  if (pos > 0) {
    // Declare exit levels: sell on snap-back above EMA20 or RSI>55
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }] },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 snap-back', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 55, closed: true }] }
    ]);
    if (price > ema20 || rsi > 55) {
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

  // Declare entry levels: buy when price falls below either band with RSI filter
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }] },
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }] }
  ]);

  if (bollingerFlush || keltnerPullback) {
    const riskEq = 0.01 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = (ctx.cash / price) * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
