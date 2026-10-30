/*
 * @coinsori-strategy v1
 * name: BTC VIX Panic Contrarian 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: VIX spiking into extreme fear in equities marks panic that drags crypto down
 * too. When the long-term crypto trend is still up, that panic is a dip to buy, not the end of the
 * bull. VIX is macro data that price alone cannot see.
 * When it buys and sells: Buy when VIX is in panic (>28) while the 200-bar trend is rising and price
 * is below its 50-bar average (a dip). Sell when VIX falls back to calm (<22) or on a 12% hard stop.
 * When it does NOT work: In a bear market the rising-trend gate keeps it out (good). But a bull that
 * never produces a VIX panic is missed, and a genuine crash can hit the stop before the bounce.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const vix = ctx.data('base_vix'); // CBOE VIX, daily, lag 2d (no look-ahead)
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma200prev == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop
    ctx.watch([
      { side: 'sell', price: 22, trigger: 'below', note: 'VIX calm exit' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    // Exit when fear normalizes back to calm (VIX<22) — the panic dip has played out.
    if (vix != null && vix < 22) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entryPx != null && price < entryPx * 0.88) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Entry: panic (VIX>28 — still firmly in fear territory, wider band than 30 to get enough samples)
  // + uptrend (SMA200 rising) + price below SMA50 (dip). The trend gate keeps us from buying panics
  // inside a bear — a falling knife there.
  const trendUp = sma200 > sma200prev;
  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'below', note: 'panic dip in uptrend', conds: [
      { label: 'VIX', now: vix, op: '>', ref: 28, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);
  if (vix != null && vix > 28 && trendUp && price < sma50) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
  }

  return null;
}
