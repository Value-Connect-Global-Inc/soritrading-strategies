/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crowd emotion overshoots. The Fear & Greed index (0-100) marks
 * panic and euphoria; buying right after a panic and selling once the crowd is greedy
 * again has historically rewarded patience on Bitcoin. It reads the fear_greed dataset.
 * When it buys and sells: Buys when the index climbs back above 30 within 10 days of
 * being in extreme fear (<=20) AND the 200-day average is still rising (a panic in a
 * rising long-term trend is a dip, not a bear market). Sells when price falls 4x ATR
 * below the highest close since entry (wide trailing stop that lets a recovery run).
 * When it does NOT work: in a long grinding bear market it sits in cash and misses the
 * (profitable-to-shorts) decline. Panics that start after the long-term trend has
 * already turned down are skipped. Long only, so no bear-market profit.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  const sma200b = ctx.sma(200, 51); // 200-day average 50 bars ago
  if (fg == null || sma200 == null || sma200b == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  // remember the last bar the crowd was in extreme fear
  if (fg <= 20) st.lastFearBar = ctx.i;

  if (pos === 0) {
    // entry: recovered above 30 within 10 bars of extreme fear
    const recentFear = st.lastFearBar != null && (ctx.i - st.lastFearBar) <= 10;
    // trend filter: long-term average still rising — a panic here is a dip, not a bear market
    const uptrend = sma200 > sma200b;
    if (fg > 30 && recentFear && uptrend) {
      const atr = ctx.atr(14, 1);
      if (atr == null) return null;
      st.entryPx = price;
      st.hiSinceEntry = price;
      // risk 3% of account on a 4x ATR stop
      const qty = (ctx.cash * 0.03) / (4 * atr);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // trailing reference: highest close since entry
  if (price > st.hiSinceEntry) st.hiSinceEntry = price;
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopPx = st.hiSinceEntry - 4 * atr;

  ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'4xATR trailing stop' }]);

  if (price <= stopPx) return { side:'sell', qty: pos };
  return null;
}
