/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + ATR Stop + Cooldown 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion (SMA200 + vol-target) rides down through crashes
 * and hits a 55% drawdown before the slow 200-day exit fires. This variant adds a
 * hard trailing stop-loss measured from the peak, so a crash exits early and
 * protects capital, then a cooldown prevents re-entering into a falling knife.
 * When it buys and sells: Buys when the previous close is above SMA200, sized by
 * vol-target. While holding, a trailing stop at (peak - 2.5*ATR20) exits the
 * position early on a sharp drop. After any stop exit, a 10-day cooldown waits
 * before re-entering. The 200-day below exit still applies as the final backstop.
 * When it does NOT work: In a slow grinding bear (not a sharp crash) the trailing
 * stop fires late and adds whipsaw; the cooldown can make it miss a fast V-recovery
 * after a stop-out. It trades some upside for lower drawdown.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma200 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const st = ctx.state;

  // track running peak while holding, survive restarts
  if (pos > 0) {
    const peak = (st.peak && st.peak > price) ? st.peak : price;
    ctx.state = { ...st, peak: peak };
    const stop = peak - 2.5 * atr20; // 2.5 ATR trailing stop: tight enough to cut crashes, loose enough to not whipsaw normal noise

    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'below SMA200' }
    ]);

    // trailing stop fires first
    if (prevClose < stop) {
      ctx.state = { ...ctx.state, cooldownUntil: ctx.i + 10, peak: null }; // 10-day cooldown: avoid re-entering a falling knife
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (prevClose < sma200) {
      ctx.state = { ...ctx.state, peak: null };
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // flat: cooldown blocks re-entry
  if (st.cooldownUntil != null && ctx.i < st.cooldownUntil) return null;
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma200) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
