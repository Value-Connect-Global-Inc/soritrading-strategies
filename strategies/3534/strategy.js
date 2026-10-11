/*
 * @coinsori-strategy v1
 * name: ETH 4h RSI BB Mean Reversion
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH on 4h charts frequently overextends past Bollinger Bands during panic dips and mean-reverts back to the midline.
 * When it buys and sells: Buys when RSI is oversold and price drops below the lower Bollinger Band; sells when price reaches the midline or hits an ATR stop loss.
 * When it does not work: Suffers during strong secular downtrends where price hugs the lower band and continues lower without bouncing.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;

  // Need at least 25 bars for BB and RSI
  if (ctx.i < 25) return null;

  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);

  if (rsi == null || bb == null || sma20 == null || atr == null) return null;

  const lowerBand = bb.lower;
  const upperBand = bb.upper;

  // Manage existing position
  if (pos > 0) {
    const entryPx = ctx.entryPx;
    // Hard stop loss at 2.5 * ATR below entry, or take profit at SMA20 midline
    const stopPrice = entryPx - 2.5 * atr;
    
    ctx.watch([
      { side: 'sell', price: sma20, trigger: 'above', note: 'Take profit at SMA20' },
      { side: 'sell', price: stopPrice, trigger: 'below', note: 'ATR stop loss' }
    ]);

    if (p <= stopPrice || p >= sma20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry condition: RSI < 30 and price below lower Bollinger band
  const buySignal = (rsi < 30 && p < lowerBand);

  ctx.watch([
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'BB lower + RSI oversold',
      conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'Below Lower BB', ok: p < lowerBand }
      ]
    }
  ]);

  if (buySignal) {
    // Risk 98% of cash
    const qty = (ctx.cash / p) * 0.98;
    return { side: 'buy', qty: qty };
  }

  return null;
}
