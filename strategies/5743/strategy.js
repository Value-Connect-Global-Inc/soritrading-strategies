/*
 * @coinsori-strategy v1
 * name: BTC Funding Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: When perpetual-funding turns deeply negative, shorts pay longs
 * heavily — a crowded-short signal that usually precedes a bounce. This buys the
 * panic and sells once funding normalizes. It reads POSITIONING, a completely
 * different information source from price trend or macro gates.
 * When it buys and sells: Buys when funding is at or below -0.01% per interval
 * (shorts crowded). Sells when funding climbs back to +0.02% (panic over) or price
 * falls 15% below entry (hard stop). Size is risk-based: one stop costs ~2.5% of
 * the account, so no single trade can hurt much.
 * When it does NOT work: In a real bear trend funding stays negative while price
 * keeps falling — the stop caps each loss but the strategy keeps buying falling
 * knives. In calm markets funding rarely gets extreme, so it sits in cash and lags
 * buy-and-hold badly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const funding = ctx.funding;
  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    // Exit 1: panic over — funding back to clearly positive.
    if (funding != null && funding >= 0.0002) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // Exit 2: hard stop so a real bear can't bleed the account.
    if (entryPx != null && price <= entryPx * 0.85) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null) {
      ctx.watch([{ side: 'sell', price: entryPx * 0.85, trigger: 'below', note: '15% hard stop' }]);
    }
    return null;
  }

  if (funding == null) return null; // no funding data -> stay out, never guess
  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (funding <= -0.0001) {
    // risk 2.5% of cash per trade to the 15% stop -> ~17% of equity per position
    const riskPerUnit = 0.15;
    const riskBudget = 0.025;
    const qty = (ctx.cash * riskBudget) / (price * riskPerUnit);
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
