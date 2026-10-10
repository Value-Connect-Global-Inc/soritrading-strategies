/*
 * @coinsori-strategy v1
 * name: SOL Dual-Momentum Trend 1D
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A trend is only trustworthy when several time horizons agree. SOL is
 * bought only when the 20-day AND 60-day momentum are both positive and price is above the
 * 200-day average — a confirmed uptrend. It exits on the fast 20-day momentum turning
 * negative, which catches a top weeks before the slow 200-day line would confirm it, and a
 * hard 20% stop caps any single bad entry. This is the momentum side the defensive RSI2
 * panic-dip champion does not cover.
 * When it buys and sells: Buys when the daily close is above the 200-day average AND both the
 * 20-day and 60-day % change are positive. Sells when the 20-day % change turns negative,
 * when the close falls below the 200-day average, or when price falls 20% below entry (hard
 * stop). After a stop, it only re-enters when all three horizons agree again.
 * When it does NOT work: In a choppy sideways market the 20-day momentum whipsaws around zero
 * and causes repeated small losses. It is late to re-enter after a crash bottom because it
 * waits for all three horizons to agree again. No data before Aug 2020.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const lastClose = ctx.closes.at(-2);   // last CLOSED daily bar
  const c20 = ctx.closes.at(-21);        // 20 bars before the closed bar
  const c60 = ctx.closes.at(-61);        // 60 bars before the closed bar
  const sma200 = ctx.sma(200, 1);
  if (lastClose == null || c20 == null || c60 == null || sma200 == null || c20 <= 0 || c60 <= 0) return null;

  const mom20 = lastClose / c20 - 1;   // 20-day momentum (fast trend)
  const mom60 = lastClose / c60 - 1;   // 60-day momentum (slow trend)
  const st = ctx.state;
  const pos = ctx.position;

  if (pos > 0) {
    // Fast exit: 20-day momentum turning negative catches a top weeks before the slow 200-day
    // average confirms it — this is what the rejected regime family lacked (it only used the
    // slow SMA200 exit and gave back 30-40% at each top). The SMA200 break is a backstop.
    const hardStop = (st.entryPx || price) * 0.80;  // 20% hard stop: any single bad entry
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: lastClose < sma200 ? price : null, trigger: 'below', note: 'SMA200 break' }]);
    if (mom20 < 0 || lastClose < sma200 || price <= hardStop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry: all three horizons must agree the trend is up — price above the 200-day average,
  // 20-day momentum positive AND 60-day momentum positive. Requiring all three stops us from
  // buying a bounce inside a downtrend.
  if (lastClose > sma200 && mom20 > 0 && mom60 > 0) {
    st.entryPx = price;
    const qty = (ctx.cash / price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
