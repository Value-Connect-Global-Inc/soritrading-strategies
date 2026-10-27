/*
 * @coinsori-strategy v1
 * name: BTC Buy-the-Dip Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto bull markets are built on sharp pullbacks that get
 * bought back up. Instead of following the trend (which the OBV champion does),
 * this bets on the bounce: it buys oversold dips, but ONLY while price is above
 * its 200-day average so it never catches a falling knife in a bear market.
 * When it buys and sells: buys when RSI(14) closes below 30 (oversold) while the
 * close is above the 200-day average; sells when RSI recovers above 60, or when
 * price closes back below the 200-day average (regime broke), or on a -25% hard
 * stop from entry.
 * When it does NOT work: in a slow grinding bear market the SMA200 gate keeps it
 * flat but the few dips it does buy keep falling; in a smooth uptrend with no
 * deep dips it never gets a chance to buy and underperforms buy-and-hold.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const stopPx = entry != null ? entry * 0.75 : null; // hard -25% stop on every position
    const regimeBroken = price < sma200;
    const recovered = rsi > 60; // bounce played out, take profit
    const w = [{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 regime break' }];
    if (stopPx != null) w.push({ side: 'sell', price: stopPx, trigger: 'below', note: '-25% stop' });
    w.push({ side: 'sell', price: price, trigger: 'above', note: 'RSI>60 exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] });
    ctx.watch(w);
    if (regimeBroken || recovered || (stopPx != null && price <= stopPx)) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const oversold = rsi < 30; // classic oversold: deep enough to be a real dip, rare enough to avoid churn
  const bull = price > sma200;
  ctx.watch([{
    side: 'buy', price: price, trigger: 'below', note: 'RSI<30 dip', conds: [
      { label: 'RSI(14) oversold', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'Close > SMA200', ok: bull }
    ]
  }]);
  if (oversold && bull && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
