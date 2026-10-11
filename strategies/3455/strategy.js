/*
 * @coinsori-strategy v1
 * name: BB RSI Mean Reversion 15m
 * ex: binance
 * syms: BTCUSDT
 * interval: 15m
 * cash: 10000
 *
 * Why this strategy: Exploits short-term overextensions in price by buying when price touches the lower Bollinger Band with oversold RSI and selling near the middle band or via stop loss.
 * When it buys and sells: Buys when close is at or below the lower Bollinger Band and RSI(14) < 30. Sells when close reaches the middle Bollinger Band (SMA20), or if a strict 2% stop-loss triggers.
 * When it does not work: Suffers during strong, persistent downward trends where price rides the lower band down repeatedly, causing consecutive stop-outs.
 */

function onUpdate(ctx) {
  // Need enough history for Bollinger Bands (20) and RSI (14)
  if (ctx.i < 30) return null;

  const price = ctx.price;
  const pos = ctx.position;

  // Read Bollinger Bands (20, 2.0) and RSI (14) on closed bar (ago = 1)
  const bb1 = ctx.bb(20, 2.0, 1);
  const rsi1 = ctx.rsi(14, 1);
  const bb0 = ctx.bb(20, 2.0, 0); // current bar for mid-band target or live check

  if (!bb1 || rsi1 == null || !bb0) return null;

  // Manage existing position
  if (pos > 0) {
    // Exit condition 1: reached middle band or above
    if (price >= bb0.middle) {
      ctx.watch([{ side: 'sell', price: bb0.middle, trigger: 'above', note: 'Middle BB target' }]);
      return { side: 'sell', qty: pos };
    }
    // Exit condition 2: Stop loss 2% below entry
    if (ctx.entryPx && price <= ctx.entryPx * 0.98) {
      ctx.watch([{ side: 'sell', price: ctx.entryPx * 0.98, trigger: 'below', note: 'Stop loss 2%' }]);
      return { side: 'sell', qty: pos };
    }

    ctx.watch([
      { side: 'sell', price: bb0.middle, trigger: 'above', note: 'Middle BB target' },
      { side: 'sell', price: ctx.entryPx ? ctx.entryPx * 0.98 : price * 0.98, trigger: 'below', note: 'Stop loss 2%' }
    ]);
    return null;
  }

  // Entry conditions for long
  const closes1 = ctx.closes.at(-2);
  const lower1 = bb1.lower;
  
  const isLowerTouch = closes1 <= lower1;
  const isOversold = rsi1 < 30;

  // Watch conditions for display
  ctx.watch([
    { 
      side: 'buy', 
      price: lower1, 
      trigger: 'below', 
      note: 'Lower BB touch + RSI < 30',
      conds: [
        { label: 'RSI(14) close', now: rsi1, op: '<', ref: 30, closed: true },
        { label: 'Close <= Lower BB', ok: isLowerTouch }
      ]
    }
  ]);

  if (isLowerTouch && isOversold) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty > 0) {
      return { side: 'buy', qty: qty };
    }
  }

  return null;
}
