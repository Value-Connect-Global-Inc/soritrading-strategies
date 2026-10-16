/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd sentiment. Extreme
 * fear (<=20) inside an uptrend has historically marked short-term bottoms,
 * because the crowd is most scared near a local low. The index then reverts
 * toward neutral as price recovers — a mean-reversion edge driven by
 * sentiment rather than price.
 * When it buys and sells: buys when the daily index is <=20 (extreme fear)
 * while price is above the 200-day SMA (pullback in an uptrend). Sells when
 * the index climbs back to >=60 (greed), or price falls 15% from entry (hard
 * stop), or after 120 days (time stop).
 * When it does NOT work: in a sustained bear market price is below the 200-SMA
 * so it stays flat (safe but no upside); if a crash starts from a reading
 * above 20 it never buys the bottom; the hard stop caps but cannot prevent
 * losses when extreme fear keeps printing while price keeps falling.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;   // no sentiment data for this bar yet

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    const held = ctx.state.held != null ? ctx.state.held + 1 : 1;
    ctx.state.held = held;
    // three exits: sentiment recovered, hard stop, time stop
    if (fg >= 60 || (entry != null && price <= entry * 0.85) || held >= 120) {
      ctx.state.held = null;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: entry != null ? entry * 0.85 : null, trigger: 'below', note: '15% hard stop' },
               { side: 'sell', price: null, trigger: 'below', note: 'time stop 120d' }]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) return null;
  if (!(fg <= 20)) return null;   // only buy at extreme fear inside an uptrend

  const qty = (ctx.cash / price) * 0.40;
  if (qty <= 0) return null;
  ctx.state.held = 0;
  ctx.watch([{ side: 'buy', price: price, trigger: 'below', note: 'extreme fear entry',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 20, closed: true },
                       { label: '200-SMA rising', ok: uptrend, closed: true }] }]);
  return { side: 'buy', qty };
}
