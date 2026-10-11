/*
 * @coinsori-strategy v1
 * name: DXY Dollar-Weak BTC Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto is a risk asset that tends to strengthen when the
 *   US dollar weakens. We read the dollar index from the connected dataset
 *   (ctx.data('dxy')) and are long BTC only while the dollar is below its own
 *   ~30-day average — a slow, regime-level filter, not a per-bar trigger.
 * When it buys and sells: buy when DXY falls below its 30-day mean (risk-on),
 *   sell when DXY rises back above that mean (risk-off) or on a 2x ATR stop.
 * When it does NOT work: when the dollar and crypto move together (liquidity
 *   events, 2020-style Fed injections), the regime flips and it whipsaws;
 *   DXY chopping around its mean produces many small stop-outs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const dxy = ctx.data('dxy');
  if (dxy == null) return null;   // no data → stand aside (never treat null as a level)

  // rolling buffer of the last ~30 DAILY DXY readings.
  // 4h bars mean each day appears 6 times, so 180 bars ≈ 30 days.
  const st = ctx.state || {};
  const buf = st.buf || [];
  buf.push(dxy);
  while (buf.length > 180) buf.shift();
  st.buf = buf;
  if (buf.length < 180) return null;

  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  const avg = sum / buf.length;

  const pos = ctx.position;
  if (pos > 0) {
    if (dxy > avg) return { side: 'sell', qty: pos };   // dollar strengthening = risk off
    const atr = ctx.atr(14, 1);
    if (atr == null) return null;
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };   // hard stop
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: avg, trigger: 'above', note: 'DXY risk-off' }]);
    return null;
  }

  if (dxy >= avg) return null;   // risk-off regime: stay flat

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 2 * atr;
  const riskCash = ctx.cash * 0.01;   // 1% of equity risked per position
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
