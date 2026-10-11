/*
 * @coinsori-strategy v1
 * name: SOL 4H Keltner MR Trailing
 * ex: binance
 * syms: SOL
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy:
 * SOL mean-reversion is the validated edge. The base recipe sells at a fixed
 * mid-band target, capping upside. This version uses a trailing stop instead,
 * to let strong bounces run while still protecting the profit.
 * When it buys and sells:
 * Buys when the previous close pierced below the Keltner lower band (EMA20 - 2.5xATR)
 * with RSI below 40. Sells when price falls 2x ATR from the highest point since entry
 * (trailing stop) — no fixed target.
 * When it does NOT work:
 * In a weak bounce the trailing stop exits near breakeven; in a melt-up the stop is
 * far below. Choppy markets whipsaw the trailing stop.
 *
 * 2026-01-15: watch 선언만 추가됨 (표시만 바뀜, 매매 판단은 그대로)
 */
function onUpdate(ctx) {
  const ema = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const price = ctx.price;
  if (ema == null || atr == null || rsi == null) return null;

  const lower = ema - 2.5 * atr; // validated recipe band width

  if (ctx.position > 0) {
    // track highest close since entry
    const hi = ctx.state.hi || price;
    ctx.state.hi = Math.max(hi, price);
    const stop = ctx.state.hi - 2 * atr;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing 2xATR', closed: false }
    ]);
    if (price <= stop) {
      ctx.state.lastExitBar = ctx.i;
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  if (ctx.state.lastExitBar != null && ctx.i - ctx.state.lastExitBar < 2) {
    ctx.watch([]);
    return null;
  }

  const rsiPrev = ctx.rsi(14, 2);
  if (rsiPrev == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2);
  if (rsi < 40 && prevClose <= lower) {
    ctx.watch([
      { side: 'buy', price: lower, trigger: 'below', note: 'Keltner lower band', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }
      ]}
    ]);
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  ctx.watch([]);
  return null;
}
