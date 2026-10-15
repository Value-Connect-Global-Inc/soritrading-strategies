/*
 * @coinsori-strategy v1
 * name: Fear-Greed Capitulation Rebound (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) measures crowd emotion.
 * Readings at or below 20 (extreme fear) usually mark a capitulation — the crowd
 * has sold out and price sits near a local bottom. We buy that panic and sell
 * when sentiment turns greedy again.
 * When it buys and sells: buys when the Fear & Greed Index closes at or below 20
 * AND the close is below its 100-day average (a real selloff, not a shallow dip).
 * Sells when the index closes at or above 70, after 120 days, or on a 20% hard stop.
 * When it does NOT work: in a long bear market (2022) extreme fear can last for
 * months and each "bottom" keeps falling — the hard stop caps each loss but the
 * strategy can still bleed. It also sits in cash most of the time, missing the
 * steady gains of a bull market.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fg');
  if (fg == null) return null;  // Fear & Greed data starts Feb 2018

  const pos = ctx.pos(ctx.sym);
  const c = ctx.closes;
  if (c.length < 110) return null;
  const prevClose = c.at(-2);
  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;

  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;                 // 20% hard stop: panic buys can keep falling
    const entryBar = ctx.state.entryBar;
    const daysHeld = entryBar == null ? 0 : ctx.i - entryBar;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop',
                 conds: [{ label: 'FG >= 70', now: fg, op: '>=', ref: 70, closed: true },
                         { label: 'held < 120d', ok: daysHeld < 120 }] }]);
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg >= 70) return { side: 'sell', qty: pos };          // greed: take the rebound profit
    if (daysHeld >= 120) return { side: 'sell', qty: pos };   // time stop: don't ride a dead bounce
    return null;
  }

  const capitulation = fg <= 20 && prevClose < sma100;  // extreme fear AND a real selloff
  ctx.watch([{ side: 'buy', price: sma100, trigger: 'below', note: 'close below 100-day SMA',
               conds: [{ label: 'FG <= 20', now: fg, op: '<=', ref: 20, closed: true },
                       { label: 'close < 100-SMA', ok: prevClose < sma100, closed: true }] }]);
  if (!capitulation) return null;

  const qty = (ctx.cash * 0.6) / price * 0.95;   // 60% of pool: panic entries are risky, keep a reserve
  ctx.state.entryBar = ctx.i;
  return { side: 'buy', qty };
}
