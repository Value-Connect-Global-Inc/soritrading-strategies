/*
 * @coinsori-strategy v1
 * name: BTC 1D Fear-Greed Contrarian
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * The Crypto Fear & Greed Index measures crowd emotion. Extreme fear (<25)
 * marks panic that often precedes a bounce; extreme greed (>70) marks euphoria
 * near a top. This buys panic inside an uptrend and sells euphoria or a trend break.
 * When it does NOT work: in a prolonged bear market fear stays high for months
 * and the EMA50<EMA200 filter keeps it out (good) but it also misses the eventual
 * bottom; in a slow grind the index sits between 25 and 70 and the strategy holds.
 *
 * 2026-05-07 표시만 바뀜, 매매 판단은 그대로
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (fg == null || ema50 == null || ema200 == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: 'stop 2xATR', qty: ctx.position },
      { side: 'sell', note: 'exit greed', conds: [{ label: 'FG', now: fg, op: '>', ref: 70 }] },
      { side: 'sell', note: 'trend break', conds: [{ label: 'EMA50', now: ema50, op: '<', ref: ema200, closed: true }] }
    ]);
    // Exit on greed, on trend break, or on a 2x ATR stop.
    if (fg > 70 || ema50 < ema200) return { side: 'sell', qty: ctx.position };
    if (price <= ctx.entryPx - 2 * atr) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      note: 'extreme fear in uptrend',
      conds: [
        { label: 'FG', now: fg, op: '<', ref: 25 },
        { label: 'EMA50>EMA200', ok: ema50 > ema200, closed: true }
      ]
    }
  ]);

  // Buy only extreme fear (fg<25) inside a confirmed uptrend (ema50>ema200).
  if (fg < 25 && ema50 > ema200) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
