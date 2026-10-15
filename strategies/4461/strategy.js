/*
 * @coinsori-strategy v1
 * name: Active-Address Confirmed Momentum Basket (BTC/ETH/SOL 1D)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) tends
 * to GROW while a rally is real and to stall before rallies fade. Because all crypto
 * majors are highly correlated, BTC network usage is a decent health proxy for the
 * whole market. We run the SAME momentum rule on each of three assets independently,
 * but only buy a leg when BTC usage is at/above its 30-day average — so we skip
 * "dead" rallies that price alone would let us into.
 * When it buys and sells: a leg buys when its 30-day price return is positive, its
 * close is above its 200-day EMA, and BTC active addresses are at/above their 30-day
 * average. Sells when the close falls below the 200-day EMA, the 30-day return turns
 * negative, or a 15% hard stop is hit.
 * When it does NOT work: in the early phase of a bull market, right after a crash,
 * usage is still low — the gate can make us miss the first leg of a recovery. And
 * all crypto majors are correlated, so in a broad crash every leg falls together.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // volatility target: size each leg so it contributes ~2% daily vol to the basket
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // Network-usage gate: only buy when BTC active addresses are at/above their 30-day avg.
  // If the data is missing on a bar, default to allowing the trade so the strategy
  // never silently blocks on missing data.
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'BTC addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * 0.33 * volScale;   // 1/3 of pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
