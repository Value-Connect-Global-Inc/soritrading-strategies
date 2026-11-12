/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin spends long stretches in clear bull or bear regimes that last for
 * weeks. Following the 200-bar (33-day) average keeps the account invested during uptrends and
 * moves it to cash only when the trend itself turns down, so it captures most of the upside while
 * taking a much smaller drawdown than simply holding.
 * When it buys and sells: it buys when the last closed price is above the 200-bar average and that
 * average is still rising; it sells to cash when price closes below a FALLING 200-bar average (the
 * trend has rolled over), not on every dip below the line. An 8% hard stop below the average entry
 * price protects the position from a sudden crash.
 * When it does NOT work: in a sideways, choppy market the average slopes up and down repeatedly and
 * the strategy still pays fees on whipsaws; it also enters late and exits late because it only
 * follows the trend, it never predicts the turn.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);          // 33-day trend on 4h, closed bar (no look-ahead)
  const smaPrev = ctx.sma(200, 2);
  const prevClose = ctx.closes.at(-2);  // last closed bar
  if (sma == null || smaPrev == null || prevClose == null) return null;

  const pos = ctx.position;

  // cooldown after a hard stop so we do not immediately re-buy a falling knife
  const st = ctx.state || {};
  let cd = st.cd || 0;
  if (cd > 0) ctx.state.cd = cd - 1;

  // regime: up = price above a rising trend; down = price below a falling trend
  const regimeUp = prevClose > sma && sma >= smaPrev;
  const regimeDown = prevClose < sma && sma < smaPrev;

  if (pos > 0) {
    // hard stop: a sudden crash can happen while the trend line still looks fine
    if (ctx.entryPx != null) {
      const stopPx = ctx.entryPx * 0.92; // 8% below average entry
      if (prevClose < stopPx) {
        ctx.state.cd = 12; // wait ~2 days before re-entering
        ctx.watch([{ side:'sell', price: stopPx, trigger:'below', note:'8% stop' }]);
        return { side:'sell', qty: pos, reduceOnly:true };
      }
    }
    // regime exit: the trend itself rolled over (price below a falling average)
    if (regimeDown) {
      ctx.watch([{ side:'sell', price: sma, trigger:'below', note:'regime down' }]);
      return { side:'sell', qty: pos, reduceOnly:true };
    }
    const stopLevel = ctx.entryPx != null ? ctx.entryPx * 0.92 : sma;
    ctx.watch([{ side:'sell', price: stopLevel, trigger:'below', note:'8% stop' },
               { side:'sell', price: sma, trigger:'below', note:'regime exit' }]);
    return null;
  }

  // flat: enter only in a confirmed uptrend (price above a rising 200-bar average)
  if (cd <= 0 && regimeUp) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty > 0) {
      ctx.watch([{ side:'buy', price: sma, trigger:'above', note:'regime up' }]);
      return { side:'buy', qty };
    }
  }
  ctx.watch([]);
  return null;
}
