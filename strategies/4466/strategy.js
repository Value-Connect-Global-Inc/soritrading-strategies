/*
 * @coinsori-strategy v1
 * name: Bollinger Oversold Reversion (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On daily Bitcoin, sharp sell-offs that stretch price far below
 * the 20-day lower Bollinger band with RSI deeply oversold usually snap back
 * toward the middle band. This is the OPPOSITE bet to the momentum champions —
 * buy weakness, not strength.
 * When it buys and sells: buys when the last CLOSED bar closed below the lower
 * band AND its RSI is below 33 (closed-bar values, same on backtest and live).
 * Sells when the closed bar climbs back to the middle band, RSI turns overbought,
 * or a 12% hard stop is hit.
 * When it does NOT work: in a strong crash the price can hug below the lower band
 * for weeks — mean reversion buys the knife and the stop takes repeated small
 * losses. It is a counter-trend bet that loses exactly when a real bear market
 * starts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);   // bands from CLOSED bars only
  if (bb == null) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.88;   // hard stop: 12% below entry (knife risk)
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose >= bb.mid) return { side: 'sell', qty: pos };   // reversion target reached
    if (rsi > 65) return { side: 'sell', qty: pos };            // bounce already ran
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'revert to mid band',
                 conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 65, closed: true }] }]);
    return null;
  }

  const atLower = prevClose <= bb.lower;   // closed bar below lower band
  const oversold = rsi < 33;               // closed-bar RSI deeply oversold
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'close below lower band',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 33, closed: true }] }]);
  if (!atLower || !oversold) return null;

  // half position: counter-trend buys are risky, size them down
  const qty = (ctx.cash / price) * 0.50;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
