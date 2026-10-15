/*
 * @coinsori-strategy v1
 * name: DXY Macro Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a dollar-denominated risk asset that tends to
 * rally when the US dollar weakens and fall when the dollar strengthens. A
 * "dollar clearly below its 20-day average" regime should produce cleaner
 * signals than the step-like fed funds rate. A hysteresis band (0.5%) stops the
 * regime from flipping on tiny DXY wobbles.
 * When it buys and sells: buys BTC when the dollar is below 99.5% of its 20-day
 * average AND price is above its 200-day SMA (no falling knives); sells when the
 * dollar recovers to 100.5% of its 20-day average or a 2xATR stop is hit.
 * When it does NOT work: the dollar-BTC link is a correlation, not a law — BTC
 * can rally on its own (2023-24 ETF bull) while the dollar drifts sideways, and
 * the regime can flip late at turning points.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.hist = s.hist ?? [];
    const d = Number(ctx.data('dxy')); // data() returns strings — coerce!
    if (Number.isFinite(d)) s.hist.push(d);
    if (s.hist.length > 20) s.hist.shift();
    s.lastBarI = ctx.i;
  }
  if (s.hist == null || s.hist.length < 20) return null;

  const cur = s.hist[s.hist.length - 1];
  const avg = s.hist.reduce((a, b) => a + b, 0) / s.hist.length;
  const weakDollar = cur < avg * 0.995;   // hysteresis: only act on a clear move
  const strongDollar = cur > avg * 1.005; // 0.5% band stops regime-flip churn

  const pos = ctx.position;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      const stopPx = entry - 2 * atr; // hard stop caps single-position loss
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' }]);
    }
    if (strongDollar) return { side: 'sell', qty: pos }; // dollar clearly firming
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (weakDollar && price > sma200) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
