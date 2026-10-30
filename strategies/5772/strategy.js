/*
 * @coinsori-strategy v1
 * name: BTC VIX Panic + Trend Pullback 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A VIX spike into extreme fear drags crypto down even when the long-term trend is
 * up — that panic is a dip to buy. But panic events are rare, so in calm regimes it sat idle. This
 * version adds a normal trend-pullback entry so it participates in both panic dips and ordinary dips.
 * VIX is macro data that price alone cannot see.
 * When it buys and sells: Buy either (1) a VIX panic (>28) dip below the 50-bar average in a rising
 * 200-bar uptrend, or (2) a normal dip below the 50-bar average in an uptrend when VIX is calm. Sell
 * when VIX falls back to calm (<22) after a panic entry, or on a 12% hard stop for any entry.
 * When it does NOT work: In a bear market the rising-trend gate keeps it out (good). But a bull that
 * chops sideways without pullbacks is missed, and a genuine crash can hit the stop before the bounce.
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
    const wasPanic = ctx.state.wasPanic === 1;
    ctx.watch([
      { side: 'sell', price: 22, trigger: 'below', note: 'VIX calm exit' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    // Exit panic entries when fear normalizes (VIX<22). Normal entries just ride the stop.
    if (wasPanic && vix != null && vix < 22) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: uptrend (SMA200 rising). Then either a VIX panic (>28) dip, or a calm dip below SMA50.
  const trendUp = sma200 > sma200prev;
  if (!trendUp) return null;

  const panic = (vix != null && vix > 28);
  const dip = price < sma50;
  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'below', note: 'panic dip in uptrend', conds: [
      { label: 'VIX', now: vix, op: '>', ref: 28, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]},
    { side: 'buy', price: sma50, trigger: 'below', note: 'calm pullback in uptrend', conds: [
      { label: 'VIX', now: vix, op: '<=', ref: 28, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);

  if (dip) {
    // Panic entry is the high-conviction core; calm entry adds participation in quiet regimes.
    if (panic) {
      ctx.state.wasPanic = 1;
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
    }
    if (vix != null && vix <= 28) {
      ctx.state.wasPanic = 0;
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
    }
  }
  return null;
}
