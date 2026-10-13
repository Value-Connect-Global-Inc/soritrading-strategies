/*
 * @coinsori-strategy v1
 * name: BtcHashrateTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a real bull market needs both price and the network behind it.
 * Bitcoin's hash rate (mining power) is slow-moving and hard to fake; when it stays
 * above its own 30-day average while price trades clearly above a RISING 200-day
 * average, the trend is backed by actual network expansion, not just speculation.
 * When it buys and sells: Buys when price is at least 3% above the 200-day average,
 * that average is still rising, and hash rate is above its 30-day average — sized so a
 * 3x ATR stop risks 2% of the account. Sells when price falls 4x ATR below the highest
 * close since entry (trailing stop — lets a winner run while still cutting losers).
 * When it does NOT work: in choppy sideways markets the 200-day average is flat and the
 * entry condition flickers (buy late, sell late); the trailing stop gives back part of a
 * sharp top before exiting. Long only, so it earns nothing in a bear market.
 */

function onUpdate(ctx) {
  const h = ctx.data('hashrate');
  const h30 = ctx.data('hashrate_sma30');
  const sma200 = ctx.sma(200, 1);
  const sma200b = ctx.sma(200, 51); // 200-day average 50 bars ago — is the trend rising?
  if (h == null || h30 == null || sma200 == null || sma200b == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos === 0) {
    // 3% buffer above SMA200 filters whipsaw near the flat average
    const uptrend = price > sma200 * 1.03 && sma200 > sma200b && h > h30;
    if (uptrend) {
      const qty = (ctx.cash * 0.02) / (3 * atr); // risk 2% of account on a 3x ATR stop
      st.entryPx = price;
      st.hiSinceEntry = price;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  // trailing reference: highest close since entry
  if (price > st.hiSinceEntry) st.hiSinceEntry = price;
  const stopPx = st.hiSinceEntry - 4 * atr; // 4x ATR — wide enough to survive normal pullbacks

  ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '4xATR trailing stop' }]);

  if (price <= stopPx) return { side: 'sell', qty: pos };
  return null;
}
