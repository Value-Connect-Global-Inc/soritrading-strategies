/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Bull-Dip 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme fear in a bull market marks a dip, not a regime change; extreme
 * fear in a bear market is a falling knife. So we only buy fear when price is still above its
 * 200-day average (uptrend intact), and sell on greed or a hard stop.
 * When it buys and sells: buys when the Fear & Greed Index closes below 25 AND price closes
 * above the 200-day average. Sells when the index closes above 70, or on a -15% hard stop.
 * When it does NOT work: in a prolonged bear the 200-day gate keeps us out (good), but the
 * greed exit is slow so we give back gains in sharp reversals. If the index never reaches 70
 * in a muted rally the position sits too long. Needs the fear_greed dataset connected.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // sentiment data not available yet — never treat null as 0
  const c = ctx.closes;
  if (c.length < 202) return null;

  const prevClose = c.at(-2); // last CLOSED bar
  let s = 0;
  for (let k = 2; k <= 201; k++) s += c[c.length - k];
  const sma200 = s / 200;
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.85; // -15% hard stop caps falling-knife loss
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (fg >= 70) return { side: 'sell', qty: pos }; // extreme greed = sell euphoria
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '-15% hard stop' },
               { side: 'sell', price: null, note: 'FG>=70 greed exit',
                 conds: [{ label: 'FG index', now: fg, op: '>=', ref: 70, closed: true }] }]);
    return null;
  }

  // only buy fear inside an intact uptrend (price above 200d average) — otherwise it is a knife
  if (fg < 25 && prevClose > sma200) {
    const qty = ctx.cash * 0.9 / price;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: null, note: 'FG<25 fear in uptrend',
                 conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true },
                         { label: 'price>SMA200', ok: prevClose > sma200, closed: true }] }]);
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', price: null, note: 'FG<25 fear in uptrend',
               conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true },
                       { label: 'price>SMA200', ok: prevClose > sma200, closed: true }] }]);
  return null;
}
