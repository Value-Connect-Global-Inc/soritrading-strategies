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
 * being in extreme fear (<=20) AND price is above its 200-day average (only panic dips
 * in an uptrend). Sells when the index reaches 70 (greed), or price falls 12% below
 * entry, or after 90 days.
 * When it does NOT work: in a long grinding bear market it sits in cash and misses the
 * (profitable-to-shorts) decline. In a strong bull leg with no panic it also sits in
 * cash. It never profits from bear markets — long only.
 */

function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const sma200 = ctx.sma(200, 1);
  if (fg == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;

  // remember the last bar the crowd was in extreme fear
  if (fg <= 20) st.lastFearBar = ctx.i;

  if (pos === 0) {
    // entry: recovered above 30 within 10 bars of extreme fear AND uptrend filter
    const recentFear = st.lastFearBar != null && (ctx.i - st.lastFearBar) <= 10;
    // uptrend filter: only buy panic dips in an established uptrend, bear-market rallies fail
    if (fg > 30 && recentFear && price > sma200) {
      st.entryPx = price;
      st.entryBar = ctx.i;
      // risk 3% of account on a 12% stop => ~25% of account per trade
      const qty = (ctx.cash * 0.03) / (price * 0.12);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  const entryPx = st.entryPx;
  if (entryPx == null) return null;
  const stopPx = entryPx * 0.88;
  const daysHeld = ctx.i - (st.entryBar != null ? st.entryBar : ctx.i);

  ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'12% stop' }]);

  if (fg >= 70) return { side:'sell', qty: pos };        // crowd greedy again: take profit
  if (price <= stopPx) return { side:'sell', qty: pos }; // hard stop loss
  if (daysHeld >= 90) return { side:'sell', qty: pos };  // time stop: free up capital
  return null;
}
