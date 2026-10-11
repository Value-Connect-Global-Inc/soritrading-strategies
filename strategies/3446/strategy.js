/*
 * @coinsori-strategy v1
 * name: Sentiment Gated Trend Following Refined
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend following in crypto captures multi-week momentum, but raw moving-average crosses suffer in chop. Adding Fear & Greed sentiment gating prevents entering long positions during panic extremes.
 * When it buys and sells: Buys when the 20 EMA crosses above the 50 EMA and the Fear & Greed index is above 25 (avoiding deep panic). Sells when the 20 EMA crosses below the 50 EMA, or a 3.5% stop-loss is hit.
 * When it does not work: Persistent sideways markets with frequent false moving average crossovers cause whipsaw losses and fee drag.
 */

function onUpdate(ctx) {
  // We need at least 50 bars for EMA 50
  if (ctx.i < 50) return null;

  const ema20_now = ctx.ema(20, 0);
  const ema20_prev = ctx.ema(20, 1);
  const ema50_now = ctx.ema(50, 0);
  const ema50_prev = ctx.ema(50, 1);

  if (ema20_now == null || ema20_prev == null || ema50_now == null || ema50_prev == null) return null;

  // External sentiment check via Fear & Greed dataset
  const fg = ctx.data('fear_greed');
  
  // Guard position exit or entry
  const pos = ctx.position;
  const price = ctx.price;
  const entryPx = ctx.entryPx;

  // Check stop loss (3.5%)
  if (pos > 0 && entryPx > 0) {
    const pnlPct = (price - entryPx) / entryPx;
    if (pnlPct <= -0.035) {
      ctx.watch([{ side: 'sell', price: entryPx * 0.965, trigger: 'below', note: 'Stop Loss 3.5%' }]);
      return { side: 'sell', qty: pos };
    }
  }

  // Golden cross: EMA 20 crosses above EMA 50
  const goldenCross = ema20_prev <= ema50_prev && ema20_now > ema50_now;
  // Death cross: EMA 20 crosses below EMA 50
  const deathCross = ema20_prev >= ema50_prev && ema20_now < ema50_now;

  if (pos <= 0 && goldenCross) {
    // Sentiment filter: only buy if FG > 25 (or null if dataset unavailable)
    const fgOk = (fg == null || fg > 25);
    
    ctx.watch([
      { side: 'buy', price: price, trigger: 'above', note: 'EMA 20/50 Golden Cross', 
        conds: [
          { label: 'FG > 25', ok: fgOk },
          { label: 'EMA20 > EMA50', now: ema20_now, op: '>', ref: ema50_now, closed: true }
        ] 
      }
    ]);

    if (fgOk) {
      const qty = (ctx.cash / price) * 0.99;
      return { side: 'buy', qty: qty };
    }
  }

  if (pos > 0 && deathCross) {
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'EMA 20/50 Death Cross' }]);
    return { side: 'sell', qty: pos };
  }

  // Default watch for active position exit
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: entryPx * 0.965, trigger: 'below', note: 'Stop Loss 3.5%' },
      { side: 'sell', price: price * 0.98, trigger: 'below', note: 'Death Cross exit' }
    ]);
  }

  return null;
}
