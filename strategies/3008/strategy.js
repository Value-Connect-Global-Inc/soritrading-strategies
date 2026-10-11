/*
 * @coinsori-strategy v1
 * name: ETH 1D Dual-MR Defensive Full-Cash
 * ex: binance
 * syms: ETHUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The BTC 1D ledger shows defensive mean-reversion is the only robust
 * edge. This applies the exact same validated Dual-MR core (Bollinger-RSI flush OR
 * ATR-Keltner pullback, rising 200-day gate, full-cash sizing) to ETH 1D to test whether
 * the edge GENERALIZES beyond BTC — if it holds, the defensive MR edge is asset-independent,
 * not a BTC-specific artifact.
 * When it buys and sells: Buy when price closes below the lower Bollinger band (20,2.5)
 * with RSI<30, OR below the ATR-adaptive lower Keltner band with RSI<40, all only inside a
 * rising 200-day average. Size with ~95% of cash. Sell on the snap-back above the 20-day
 * EMA or when RSI climbs above 55.
 * When it does NOT work: In a sustained bear the rising-trend gate keeps us flat, and it
 * lags buy-and-hold in a relentless melt-up. Full-cash sizing means a single wrong flush
 * costs more than a risk-sized version.
 *
 * 2025-01-01: display-only change — added ctx.watch declarations to show what the strategy
 * is waiting for each tick. Trading logic unchanged.
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
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  if (pos > 0) {
    // Exit watch: sell above EMA20 or RSI>55
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 55, closed: true }] },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '>=', ref: 55, closed: true }] }
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

  // Entry watch: buy below lowerBB with RSI<30, or below Keltner with RSI<40
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }, { label: 'SMA200 rising', ok: uptrend }] },
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low touch', conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }, { label: 'SMA200 rising', ok: uptrend }] }
  ]);

  if (bollingerFlush || keltnerPullback) {
    const qty = (ctx.cash / price) * 0.95;
    return { side: 'buy', qty: qty };
  }
  return null;
}
