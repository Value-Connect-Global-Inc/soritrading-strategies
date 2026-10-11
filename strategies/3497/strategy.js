/*
 * @coinsori-strategy v1
 * name: EMA Trend ATR Stop BTC 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following using EMA 20/50 crossover with RSI confirmation, enhanced by an ATR trailing stop to protect gains during volatile pullbacks.
 * When it buys and sells: Buys when EMA 20 crosses above EMA 50 with RSI(14) > 50. Sells when price hits the trailing stop or EMA 20 crosses below EMA 50.
 * When it does NOT work: Choppy, sideways markets where frequent false breakouts trigger whipsaws and trailing stop exits near local bottoms.
 */

function onUpdate(ctx) {
  const p = ctx.price;
  const pos = ctx.position;

  // Read indicators on closed bars (ago >= 1)
  const ema20_1 = ctx.ema(20, 1);
  const ema20_2 = ctx.ema(20, 2);
  const ema50_1 = ctx.ema(50, 1);
  const ema50_2 = ctx.ema(50, 2);
  const rsi_1 = ctx.rsi(14, 1);
  const atr_1 = ctx.atr(14, 1);

  if (ema20_1 == null || ema20_2 == null || ema50_1 == null || ema50_2 == null || rsi_1 == null || atr_1 == null) {
    return null;
  }

  // Persistent state for trailing stop tracking
  if (!ctx.state.highWaterMark) ctx.state.highWaterMark = 0;
  if (!ctx.state.stopPrice) ctx.state.stopPrice = 0;

  if (pos > 0) {
    if (p > ctx.state.highWaterMark) {
      ctx.state.highWaterMark = p;
      // 2.5 ATR trailing stop distance
      ctx.state.stopPrice = Math.max(ctx.state.stopPrice, p - (2.5 * atr_1));
    }

    // Exit conditions: Trailing stop hit or EMA bearish crossover
    const stopHit = p <= ctx.state.stopPrice;
    const bearishCross = ema20_2 >= ema50_2 && ema20_1 < ema50_1;

    ctx.watch([
      { side: 'sell', price: ctx.state.stopPrice, trigger: 'below', note: 'ATR Trailing Stop' },
      { side: 'sell', price: ctx.state.highWaterMark, trigger: 'above', note: 'High Water Mark' }
    ]);

    if (stopHit || bearishCross) {
      ctx.state.highWaterMark = 0;
      ctx.state.stopPrice = 0;
      return { side: 'sell', qty: pos };
    }
  } else {
    // Reset state when flat
    ctx.state.highWaterMark = 0;
    ctx.state.stopPrice = 0;

    const bullishCross = ema20_2 <= ema50_2 && ema20_1 > ema50_1;
    const rsiOk = rsi_1 > 50; // Strong momentum filter

    ctx.watch([
      { 
        side: 'buy', 
        price: p, 
        trigger: 'above', 
        note: 'EMA Crossover + RSI > 50',
        conds: [
          { label: 'RSI(14)', now: rsi_1, op: '>', ref: 50, closed: true },
          { label: 'EMA20 > EMA50', ok: bullishCross }
        ]
      }
    ]);

    if (bullishCross && rsiOk) {
      ctx.state.highWaterMark = p;
      ctx.state.stopPrice = p - (2.5 * atr_1);
      return { side: 'buy', qty: (ctx.cash / p) * 0.99 };
    }
  }

  return null;
}
