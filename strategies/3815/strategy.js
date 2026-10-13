/*
 * @coinsori-strategy v1
 * name: BtcHashrateTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a real bull market needs both price and the network behind it.
 * Bitcoin's hash rate (mining power) is slow-moving and hard to fake; when it rises
 * above its own 30-day average while price holds above the 200-day average, the trend
 * is backed by actual network expansion, not just speculation.
 * When it buys and sells: Buys when both conditions flip on together (price above
 * SMA200 AND hash rate above its 30d average), sized so a 3x ATR stop risks 2% of the
 * account. Sells when either condition turns off, or price falls 3x ATR below entry.
 * When it does NOT work: in choppy sideways markets the two slow signals whipsaw
 * (buy late, sell late), and the network filter lags a real rally — it gives back the
 * first leg of a bounce. Long only, so it earns nothing in a bear market.
 */

function onUpdate(ctx) {
  const h = ctx.data('hashrate');
  const h30 = ctx.data('hashrate_sma30');
  const sma200 = ctx.sma(200, 1);
  if (h == null || h30 == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  const uptrend = price > sma200 && h > h30; // both trend and network agree
  const prevUptrend = st.prevUptrend === true;
  st.prevUptrend = uptrend;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  if (pos === 0) {
    // fresh regime flip on = both conditions just became true
    if (uptrend && !prevUptrend) {
      const qty = (ctx.cash * 0.02) / (3 * atr); // risk 2% of account on a 3x ATR stop
      st.entryPx = price;
      return { side: 'buy', qty: qty };
    }
    return null;
  }

  const stopPx = st.entryPx != null ? st.entryPx - 3 * atr : price - 3 * atr;
  ctx.watch([
    { side: 'sell', price: stopPx, trigger: 'below', note: '3xATR hard stop' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }
  ]);

  if (!uptrend || price <= stopPx) return { side: 'sell', qty: pos };
  return null;
}
