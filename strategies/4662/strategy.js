/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Daily active Bitcoin addresses measure real network usage — a
 * different axis from price. When network adoption is growing (active addresses
 * above their 30-day average) AND price is above its 200-day average, the bull
 * trend has fundamental support and is worth riding. This is a regime strategy,
 * not a breakout chaser: it stays invested while both price trend and on-chain
 * usage are up.
 * When it buys and sells: buys when price is above both the 200-day and 50-day
 * averages while network adoption is growing. Sells when price falls below the
 * 50-day average or network adoption starts shrinking.
 * When it does NOT work: it whipsaws in choppy sideways markets where price and
 * adoption oscillate around their averages, and it lags sharp V-shaped
 * recoveries because it waits for the 50-day average to turn.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;   // need 200-SMA warm-up

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null || !(addrSma > 0)) return null;   // unknown data = no trade

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (sma200 == null || sma50 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const adoptionFading = addr < addrSma;
    if (price < sma50 || adoptionFading) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: '50-day exit',
                 conds: [{ label: 'adoption fading', ok: adoptionFading, closed: true }] }]);
    return null;
  }

  const adoptionUp = addr > addrSma;
  const bull = price > sma200;
  const momentum = price > sma50;
  if (!adoptionUp || !bull || !momentum) return null;

  ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'bull + adoption',
               conds: [{ label: 'price>200d', ok: bull, closed: true },
                       { label: 'price>50d', ok: momentum, closed: true },
                       { label: 'addr>30d avg', ok: adoptionUp, closed: true }] }]);

  const qty = (ctx.cash * 0.95 / price) * 0.98;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
