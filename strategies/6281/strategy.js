/*
 * @coinsori-strategy v1
 * name: ETH Fear-Greed Contrarian 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index measures crowd emotion. Extreme fear (index <= 25)
 * marks panic-selling lows — historically good entry points, especially when the panic happens inside a
 * longer uptrend. Extreme greed (index >= 65) marks euphoria where it pays to take profit. This is a
 * sentiment data axis (external DB), not a price-only signal.
 * When it buys and sells: it buys when the index is 25 or below AND the 4h close is still above the
 * 200-bar average (a panic dip in a bull market, not a crash in a bear market). It sells when the index
 * reaches 65 (greed), the close falls below the 200-bar average, or price drops 2.5xATR below entry.
 * When it does NOT work: in a straight-line melt-up the index stays greedy, so it is in the market only
 * part of the time and trails buy-and-hold; the index is daily data so it cannot time intraday moves;
 * and in a slow grinding bear market the uptrend filter keeps it flat, which is safe but useless.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const fg = ctx.data('fear_greed');
  const atr = ctx.atr(14, 1);
  if (atr == null) { ctx.watch([]); return null; }

  // Regime filter: only buy panic dips inside a longer uptrend.
  if (prevClose < sma200) {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'Trend broke - exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Wait for uptrend' }]);
    return null;
  }

  if (pos > 0) {
    const entry = ctx.entryPx;
    // Hard stop: 2.5xATR below entry limits loss on a panic dip that keeps falling.
    const stopPx = (entry != null) ? entry - 2.5 * atr : price * 0.85;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'Trend broke' },
      { side: 'sell', price: stopPx, trigger: 'below', note: '2.5xATR stop' },
      { side: 'sell', price: sma200, trigger: 'above', note: 'Greed take-profit',
        conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 65, closed: true }] }
    ]);
    if (fg != null && fg >= 65) {
      return { side: 'sell', qty: pos, reduceOnly: true }; // crowd euphoric -> take profit
    }
    if (prevClose <= stopPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (fg != null && fg <= 25) {
    let qty = ctx.cash / price * 0.99;
    // Risk 30% of equity on the 2.5xATR stop, capped at full cash.
    qty = Math.min(qty, (ctx.cash * 0.30) / (2.5 * atr));
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend',
      conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 25, closed: true }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Panic dip in uptrend',
    conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 25, closed: true }] }]);
  return null;
}
