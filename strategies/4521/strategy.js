/*
 * @coinsori-strategy v1
 * name: Fear-Greed Sentiment Regime + Trailing Stop (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Fear-Greed sentiment regime (4516) rides the
 * greed zone but gives back gains in fast V-crashes. This keeps the same entry
 * and the same 25% stop, but the stop RATCHETS UP as price makes new highs, so
 * a crash converts a peak into a smaller loss instead of riding it all the way
 * down. State degrades gracefully: if state does not persist, this equals the
 * baseline, so it cannot be worse by construction.
 * When it buys and sells: buys when F&G >= 55; sells when F&G drops to 40 or the
 * trailing stop (25% below the highest price since entry) is hit.
 * When it does NOT work: in long sideways chop the index sits in the 40-55 band
 * (keeps it flat, misses range rallies); in a sharp bull pullback the tightened
 * stop can exit before the rally resumes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // unknown sentiment = stay flat

  const pos = ctx.position;
  const st = ctx.state;
  if (pos > 0) {
    if (st.hi == null) st.hi = ctx.entryPx;        // start trailing from entry price
    if (price > st.hi) st.hi = price;              // ratchet up with new highs
    const stop = st.hi * 0.75;                     // 25% below the highest since entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg <= 40) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: 40, trigger: 'below', note: 'exit: F&G <= 40',
                 conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 40, closed: true }] }]);
    return null;
  }

  st.hi = null; // flat: reset the trailing high
  const enter = fg >= 55;
  ctx.watch([{ side: 'buy', price: 55, trigger: 'above', note: 'enter: F&G >= 55',
               conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
