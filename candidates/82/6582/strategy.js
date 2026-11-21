/*
 * @coinsori-strategy v1
 * name: BTC 1H Trend Pullback Long-Short
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 1h
 * cash: 1000
 *
 * Why this strategy: On 1h BTC perpetuals a fast EMA crossing a slow EMA marks the start of a trend, and riding it with a trailing stop captures the move both up and down.
 * When it buys and sells: Goes long when the 50 EMA crosses above the 200 EMA; goes short when the 50 EMA crosses below the 200 EMA. Closes only on a 4x ATR trailing stop from the peak/trough.
 * When it does NOT work: In a sideways range the two EMAs cross back and forth and each fresh stop-out is a small loss. A sharp reversal can stop out a trade right before the trend resumes.
 */

function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1);
  const emaS = ctx.ema(200, 1);
  const emaFp = ctx.ema(50, 2);
  const emaSp = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  const c0 = ctx.closes.at(-2);

  if (emaF == null || emaS == null || emaFp == null || emaSp == null || atr == null || c0 == null) return null;

  const pos = ctx.position;
  const st = ctx.state || {};

  const longSignal = emaFp <= emaSp && emaF > emaS;   // fast EMA crossed above slow EMA
  const shortSignal = emaFp >= emaSp && emaF < emaS;  // fast EMA crossed below slow EMA

  if (pos > 0) {
    const trail = st.trail == null ? c0 : Math.max(st.trail, ctx.highs.at(-2));
    const stop = trail - 4 * atr;   // 4x ATR from the peak: room to survive 1h noise
    ctx.state = { trail, side: 1 };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' }]);
    if (ctx.lows.at(-1) <= stop) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const trail = st.trail == null ? c0 : Math.min(st.trail, ctx.lows.at(-2));
    const stop = trail + 4 * atr;
    ctx.state = { trail, side: -1 };
    ctx.watch([{ side: 'buy', price: stop, trigger: 'above', note: 'ATR trailing stop' }]);
    if (ctx.highs.at(-1) >= stop) {
      return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  if (longSignal) {
    const qty = (ctx.cash * 0.5) / ctx.price;   // half the wallet as margin keeps a losing streak survivable
    ctx.state = { trail: c0, side: 1 };
    ctx.watch([{ side: 'buy', price: emaS, trigger: 'above', note: 'EMA50/200 cross entry' }]);
    return { side: 'buy', qty: qty };
  }

  if (shortSignal) {
    const qty = (ctx.cash * 0.5) / ctx.price;
    ctx.state = { trail: c0, side: -1 };
    ctx.watch([{ side: 'sell', price: emaS, trigger: 'below', note: 'EMA50/200 cross entry' }]);
    return { side: 'sell', qty: qty };
  }

  ctx.watch([]);
  return null;
}
