/*
 * @coinsori-strategy v1
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 * name: BTC 1D Bollinger-RSI Defensive Mean Reversion
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ledger shows mean reversion is the ONLY validated edge on
 * BTC 1D (every trend/momentum family failed). This is a defensive mean-reversion
 * flavor: buy a deep oversold flush to the lower Bollinger band with RSI crushed,
 * but ONLY inside a healthy long-term uptrend so we never catch a falling knife in
 * a broad bear. Uses only core indicators (Bollinger, RSI, ATR, SMA) that are always
 * available in backtest — no external data. It trades rarely (that is the point:
 * defensive MR wins because it avoids the whipsaw that trend modes produce).
 * When it buys and sells: Buys when price closes below the lower Bollinger band
 * (20, 2.5) with RSI below 30, while price is above a rising 200-day average, sized
 * by ATR risk (1% of equity) capped at 90% of cash. Sells on the snap-back above the
 * 20-day average or when RSI climbs above 55.
 * When it does NOT work: In a broad crypto bear the 200-day gate keeps us out of most
 * trades (capital-preserving but captures little). It lags buy-and-hold in a relentless
 * melt-up because it sits in cash waiting for a pullback. Low trade count means the edge
 * depends on the few flushes that actually mark a local bottom.
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

  // Only mean-revert inside a rising long-term trend — the gate that makes this
  // family safe (per ledger, ungated MR on alts was a disaster).
  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;

  if (pos > 0) {
    // Take the snap-back profit above the mid band or once RSI turns up.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', note: 'SMA20 exit' },
      { side: 'sell', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 55, closed: true }], note: 'RSI exit' }
    ]);
    if (price > ema20 || rsi > 55) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Defensive entry: deep oversold flush below the lower Bollinger band in an uptrend.
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower touch', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);

  if (uptrend && price < lowerBand && rsi < 30) {
    // ATR-scaled size: risk 1% of equity per trade, capped at 90% of cash.
    const riskEq = 0.01 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = (ctx.cash / price) * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
