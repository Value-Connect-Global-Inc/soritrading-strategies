/*
 * @coinsori-strategy v1
 * name: BTC BB+RSI Oversold Bounce 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto overshoots on the downside — when the daily close is
 * both below the lower Bollinger band AND the RSI is oversold, the panic is usually
 * a short-term buying opportunity. But this only works when the LONGER trend is up:
 * in an uptrend dips get bought and recover, in a downtrend they keep falling. So we
 * only mean-revert when price is above its 200-day average.
 * When it buys and sells: Buys the next bar when the previous close is below the
 * lower Bollinger band (20,2), RSI(14) < 30, AND price is above the 200-day SMA.
 * Sells when the close recovers above the 20-day average, or at a hard 8% stop.
 * Size is risk-based: one stop costs ~1.5% of the account.
 * When it does NOT work: In a bear market it sits flat (no buys below the 200d SMA)
 * and so misses the whole downside — but that is the point, it avoids the bleed. It
 * also underperforms in strong uptrends where dips rarely get that oversold.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const sma20 = ctx.sma(20, 1);
  const sma200 = ctx.sma(200, 1);
  if (rsi == null || bb == null || sma20 == null || sma200 == null) return null;
  const lower = bb.lower;
  if (lower == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    // Exit 1: recovery to the 20-day average = mean reversion done.
    if (prevClose > sma20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // Exit 2: hard stop so a real bear can't bleed the account.
    if (entryPx != null && price <= entryPx * 0.92) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null) {
      ctx.watch([{ side: 'sell', price: entryPx * 0.92, trigger: 'below', note: '8% hard stop' }]);
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  // Only mean-revert in a long-term uptrend (price above 200d SMA).
  if (prevClose < sma200) return null;

  // Double oversold on the CLOSED bar: below BB lower AND RSI < 30.
  if (prevClose < lower && rsi < 30) {
    // risk 1.5% of cash to the 8% stop -> ~19% of equity per position
    const qty = (ctx.cash * 0.015) / (price * 0.08);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
