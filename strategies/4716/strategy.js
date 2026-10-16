/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Gated Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A 55-day Donchian breakout is a proven trend signal on BTC, but it buys
 * every breakout including false ones. Bitcoin's network usage (active addresses) is a
 * fundamental confirmation — a breakout that happens while adoption is growing is more likely
 * to be a real new trend. We gate the breakout on on-chain growth instead of buying blindly.
 * When it buys and sells: buys when price closes above its 55-day high AND the 30-day average
 * active addresses is above its 60-day-ago level (network growing). Sells on a 2x ATR stop or
 * when price closes below its 55-day low. Position size shrinks when volatility is high.
 * When it does NOT work: in choppy sideways markets with repeated false breakouts the stop
 * takes small losses; and when price and on-chain usage decouple (a pure liquidity rally with
 * no new users) the gate keeps you out of a real move. Needs the addr dataset connected.
 */
const addrHist = []; // module-level history of 30-day avg active addresses, one per bar

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const addr = ctx.data('addr_sma30');
  if (addr == null) return null; // on-chain data missing — never treat null as 0
  addrHist.push(addr);
  if (addrHist.length < 65) return null; // need 60-bar history for the gate lookback

  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first: 2x ATR hard stop or 55-day low breakdown
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
    return null;
  }

  if (!(prevClose > h55)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
    return null;
  }

  // On-chain gate: 30d avg active addresses must be above its 60d-ago level (network growing)
  const addr60 = addrHist[addrHist.length - 61];
  if (addr60 == null || !(addr > addr60)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'on-chain 30d avg rising', ok: addr > addr60, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 * volScale) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'on-chain 30d avg rising', ok: addr > addr60, closed: true }] }]);
  return { side: 'buy', qty };
}
