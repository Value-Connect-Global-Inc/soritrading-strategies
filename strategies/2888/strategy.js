/*
 * @coinsori-strategy v1
 * name: RSI2 Capitulation BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme short-horizon RSI (RSI(2) below ~5) marks rare
 * capitulation events where panic selling exhausts itself and price snaps back.
 * This is a distinct family from the Keltner band mean-reversion: it waits for
 * true panic (RSI2 < 5) rather than a gentler band touch, so it trades far less
 * often but each trade is a deeper, more reliable snap-back.
 * When it buys and sells: buys when RSI(2) drops below 5 (capitulation) while
 * price is above the 200-day average; sells when RSI(2) recovers above 50 or
 * after a fixed 10-bar hold. A cooldown prevents re-buying into the same flush.
 * When it does NOT work: in a persistent bear market below the 200-day average
 * it stays idle, and capitulation can keep going (catch a falling knife) if the
 * asset is in structural decline.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsi2 = ctx.rsi(2, 1);
  const sma200 = ctx.sma(200, 1);
  if (rsi2 == null || sma200 == null) return null;

  const st = ctx.state;

  if (pos > 0) {
    // Exit on recovery above RSI 50 or after a 10-bar max hold.
    if (rsi2 > 50 || (st.entryBar != null && ctx.i - st.entryBar >= 10)) {
      st.cooldown = ctx.i + 5;
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'exit now' }]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'exit now' }]);
    return null;
  }

  if (st.cooldown != null && ctx.i < st.cooldown) {
    ctx.watch([]);
    return null;
  }

  // Capitulation: RSI(2) below 5 while still in a long-term uptrend.
  if (price > sma200 && rsi2 < 5) {
    st.cooldown = null;
    st.entryBar = ctx.i;
    // Size modestly: risk 1% of equity per trade.
    const qty = 0.01 * ctx.cash / price;
    ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'entry now' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 touch', conds: [{ label: 'RSI(2) close', now: rsi2, op: '<', ref: 5, closed: true }] }]);
  return null;
}
