/*
 * @coinsori-strategy v1
 * name: Multi-Asset Trend Basket (BTC/ETH/SOL/BNB 1D)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a single-asset trend bet concentrates all risk in one coin. This
 * basket runs the same trend+momentum core on four majors independently, sized to a
 * share of equity, so a crash in one coin is cushioned by the others that are still
 * trending. Diversification is the edge, not any single coin.
 * When it buys and sells: on each asset, buys when the close is above the 200-day EMA
 * and the 30-day return is positive; sells when the close falls below the 200-day EMA,
 * the 30-day return turns negative, or a 15% hard stop is hit. Each asset is sized to
 * ~25% of equity, volatility-scaled down in choppy markets.
 * When it does NOT work: in a broad coordinated crypto bear every asset breaks its
 * 200-day EMA at once — the basket goes flat and earns nothing while cash sits idle.
 * It also lags a single straight-line melt-up of one asset because capital is split
 * across four instead of all-in on the winner.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.sma(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // volatility target: size so the leg contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(sym);
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

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const legShare = 0.25;                       // 4 legs = up to 100% deployed
  const targetCash = ctx.cash * legShare * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
