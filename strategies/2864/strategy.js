/*
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 * @coinsori-strategy v1
 * name: ETH 4H Keltner Mean-Reversion
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated band-bounce champion uses Bollinger bands
 * (standard-deviation based). Keltner channels use ATR-based bands instead, so
 * they widen and narrow WITH actual volatility rather than with dispersion.
 * This tests whether an ATR-adaptive band is a better mean-reversion trigger
 * for the same panic-flush edge. It buys a flush that reaches the lower Keltner
 * band while the longer trend is up, and sells on the snap-back to the middle.
 * When it buys and sells: buys when price closes at/below the lower Keltner
 * band (EMA20 - 2.5x ATR) with RSI<40 and price above the 200-bar average;
 * sells when price returns to the middle band (EMA20). A cooldown prevents
 * re-buying the same flush repeatedly.
 * When it does NOT work: in a persistent downtrend below the 200-bar average it
 * stays idle (no falling knives), and in a straight-line melt-up there are no
 * deep flushes to catch, so it lags rallies.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const lower = ema20 - 2.5 * atr; // 2.5x ATR: wide enough to catch real flushes, not noise
  const st = ctx.state;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 mid-band exit' }]);
    // Proven mid-band exit: the snap-back is done when price returns to the EMA20.
    if (price > ema20) {
      st.cooldown = ctx.i + 2; // wait 2 bars before re-entering the same flush
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Cooldown: after a failed trade, wait 2 bars so we don't re-buy a still-falling knife.
  if (st.cooldown != null && ctx.i < st.cooldown) {
    ctx.watch([]);
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: lower,
    trigger: 'below',
    note: 'Keltner lower band',
    conds: [
      { label: 'close > SMA200', ok: price > sma200 },
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }
    ]
  }]);

  // Entry: flush to the lower Keltner band in an uptrend, confirmed oversold.
  if (price > sma200 && price <= lower && rsi < 40) {
    st.cooldown = null;
    return { side: 'buy', qty: ctx.cash / price * 0.9 };
  }
  return null;
}
