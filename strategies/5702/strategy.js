/*
 * @coinsori-strategy v1
 * name: BTC VIX-Gated RSI2 Dip 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Sharp short-term drops in BTC tend to bounce — but only when the broader
 * market is calm (VIX < 30). During a VIX spike (systemic panic) the falling knife keeps falling,
 * so we refuse to catch it. This is mean reversion with a volatility regime gate.
 * When it buys and sells: Buys when RSI(2) is below 10 (extreme oversold) AND VIX is below 30.
 * Sells when RSI(2) recovers above 65, after 5 days, or on a 10% stop. Fixed small size per trade.
 * When it does NOT work: In a prolonged bear (2022) the bounce is weak and short — the 10% stop
 * limits damage but the strategy bleeds small losses. Also misses slow grinds with no sharp drops.
 */
function onUpdate(ctx) {
  const rsi2 = ctx.rsi(2, 1);
  const vix = ctx.data("base_vix");
  if (rsi2 == null || vix == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.9 : null; // 10% stop
    const days = ctx.state.days || 0;
    ctx.state.days = days + 1;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: '10% stop' },
      { side: 'sell', price: null, note: 'RSI recovery', conds: [{ label: 'RSI2 > 65', ok: rsi2 > 65, closed: true }] }
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (rsi2 > 65) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (days >= 5) return { side: 'sell', qty: ctx.position, reduceOnly: true }; // time exit
    return null;
  }

  const calm = vix < 30;
  ctx.watch([
    { side: 'buy', price: null, note: 'RSI2 extreme oversold', conds: [{ label: 'RSI2 < 10', ok: rsi2 < 10, closed: true }, { label: 'VIX calm < 30', ok: calm, closed: true }] }
  ]);
  if (rsi2 < 10 && calm) {
    // small fixed size (20% of cash) so a losing dip never ruins the account
    const qty = (0.2 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
