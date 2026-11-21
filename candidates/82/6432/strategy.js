/*
 * @coinsori-strategy v1
 * name: BTC 4H VIX-Regime Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: BTC trends are regime-dependent — equities fear (VIX)
 * drives crypto risk-off. When VIX is calm (below its own mean) an uptrend
 * is more likely to continue; when VIX spikes, BTC tends to fall.
 * When it buys and sells: long only when price is above EMA50 AND VIX is
 * calm; exit when price falls below EMA50 or VIX spikes into panic. This
 * filters out trend entries that happen right before a risk-off crash.
 * When it does NOT work: regime changes lag (VIX data is 2 days delayed)
 * and a sudden VIX spike can arrive after the damage. Long-only still loses
 * in sustained bear markets where calm VIX keeps the long on.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const ema = ctx.ema(50, 1);
  const emaPrev = ctx.ema(50, 2);
  if (ema == null || emaPrev == null) return null;

  const vix = ctx.data("base.vix");
  const price = ctx.price;
  const qty = (ctx.cash / price) * 0.99;

  const calm = vix != null && vix < 22;   // VIX below 22 = calm risk-on regime
  const panic = vix != null && vix > 30;  // VIX above 30 = risk-off panic

  if (ctx.position === 0) {
    // Enter only when trend is up AND regime is calm — skip breakouts into panic.
    if (price > ema && ema > emaPrev && calm) {
      ctx.watch([{ side:'buy', price: price, trigger:'above', note:'uptrend + calm VIX' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Exit when trend flips or VIX spikes to panic.
  ctx.watch([
    { side:'sell', price: ema, trigger:'below', note:'trend flip' },
    { side:'sell', price: price, trigger:'below', note:'VIX panic exit' }
  ]);
  if (price < ema) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (panic) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
