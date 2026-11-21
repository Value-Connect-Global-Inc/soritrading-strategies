/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Capitulation Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: When Bitcoin's daily active addresses collapse well below
 * their recent average, network usage is drying up — historically a moment of
 * maximum despair near a bottom. This contrarian strategy buys those washouts
 * and sells the recovery, betting that extreme on-chain capitulation is
 * followed by a bounce instead of a straight-line death.
 * When it buys and sells: buys when active addresses fall below 0.85x their
 * 30-day average AND RSI(14) is below 35 AND price is below its 200-day
 * average; sells when price recovers above the 20-day average or drops 20%
 * from entry (hard stop).
 * When it does NOT work: in a long structural bear (e.g. a multi-year
 * decline) capitulation can keep capitulating — the 20% stop caps each loss
 * but repeated stops bleed the account; it can also stay in cash for years if
 * usage never collapses.
 */
function onUpdate(ctx) {
  const price = ctx.price;

  // On-chain usage: daily unique active addresses and their 30-day average.
  const addr = ctx.data("main.addr");
  const addrSma = ctx.data("main.addr_sma30");
  if (addr == null || addrSma == null || addrSma <= 0) return null;

  const rsi1 = ctx.rsi(14, 1);
  const sma200_1 = ctx.sma(200, 1);
  const sma20_1 = ctx.sma(20, 1);
  if (rsi1 == null || sma200_1 == null || sma20_1 == null) return null;

  const close1 = ctx.closes.at(-2);
  if (close1 == null) return null;

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const stop = entry != null ? entry * 0.8 : null;
    const watch = [{ side: 'sell', price: sma20_1, trigger: 'above', note: 'recovered above 20d MA' }];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: '20% hard stop' });
    ctx.watch(watch);
    // Hard stop first: a 20% loss is the most this trade is allowed to lose.
    if (stop != null && price <= stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (close1 > sma20_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  const capitulate = addr < 0.85 * addrSma; // usage collapsed below its norm
  const oversold = rsi1 < 35;                // already beat down
  const downtrend = close1 < sma200_1;       // washout, not a fresh breakout

  ctx.watch([{ side: 'buy', price: sma200_1, trigger: 'below', note: 'capitulation: below 200d MA',
               conds: [
                 { label: 'addr < 0.85x SMA30', ok: capitulate, closed: true },
                 { label: 'RSI(14) < 35', now: rsi1, op: '<', ref: 35, closed: true },
                 { label: 'below 200d MA', ok: downtrend, closed: true }
               ] }]);

  if (capitulate && oversold && downtrend) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
