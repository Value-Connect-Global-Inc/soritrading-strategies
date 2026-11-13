/*
 * @coinsori-strategy v1
 * name: Volume-Confirmed Breakout 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Trend-following breakout on 4h BTC. We only enter when the breakout is
 * confirmed by above-average volume (fresh money, not a quiet drift), so weak
 * breakouts that reverse are skipped. We buy when the close breaks the 20-bar
 * high with volume above its average while the 200-SMA trend is up, and we
 * hold until the close falls back below the 200-SMA (trend over) or price
 * hits a hard 3x-ATR stop. This loses in sideways chop where breakouts fail
 * repeatedly, and it never shorts, so it gives back gains in bear markets.
 * The volume gate was relaxed from 1.3x to 1.15x: a milder but still
 * above-average confirmation keeps the fresh-money filter while letting the
 * strategy participate in more of an up-trend, so it trails buy-and-hold less.
 */
function onUpdate(ctx) {
  const n = ctx.closes.length;
  if (n < 210) { ctx.watch([]); return null; }

  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || prevClose == null) { ctx.watch([]); return null; }

  // Breakout window: highest high of the 20 bars BEFORE the signal bar.
  const highs = ctx.highs, L = highs.length;
  let hh = -Infinity;
  for (let k = L - 22; k <= L - 3; k++) if (highs[k] > hh) hh = highs[k];

  const volPrev = ctx.volumes.at(-2);
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) { ctx.watch([]); return null; }

  const atr1 = ctx.atr(14, 1);
  if (atr1 == null) { ctx.watch([]); return null; }

  const inPos = ctx.position > 0;

  if (!inPos) {
    // Entry: uptrend (close > 200-SMA) + breakout above the prior 20-bar high,
    // confirmed by a mild volume spike (>1.15x the 20-bar average).
    if (prevClose > sma200 && prevClose > hh && volPrev > 1.15 * avgVol) {
      const qty = ctx.cash / ctx.price * 0.98;
      ctx.watch([{ side:'buy', price: hh, trigger:'above', note:'20-bar breakout' },
                 { side:'sell', price: sma200, trigger:'below', note:'trend exit' }]);
      return { side:'buy', qty };
    }
    ctx.watch([{ side:'buy', price: hh, trigger:'above', note:'20-bar breakout' }]);
    return null;
  }

  const stop = ctx.entryPx == null ? null : ctx.entryPx - 3 * atr1;
  if (prevClose < sma200) {
    ctx.watch([{ side:'sell', price: sma200, trigger:'below', note:'trend exit' }]);
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  if (stop != null && ctx.price <= stop) {
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'3x ATR stop' }]);
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }
  ctx.watch([{ side:'sell', price: sma200, trigger:'below', note:'trend exit' },
             { side:'sell', price: stop, trigger:'below', note:'3x ATR stop' }]);
  return null;
}
