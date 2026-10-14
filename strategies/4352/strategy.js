/*
 * @coinsori-strategy v1
 * name: Hashrate-Confirmed Donchian Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-coin Donchian breakout basket is the validated
 *   champion. This variant adds an on-chain filter: only take a breakout when
 *   the bitcoin mining network is still expanding (hashrate above its own
 *   30-day average) — the idea being that breakouts backed by network growth
 *   are more durable. Tests whether on-chain data adds value to a proven recipe.
 * When it buys and sells: for each coin, buy on a fresh 55-bar high close only
 *   when hashrate is above its 30-day average. Sell on a 20-bar low close, a
 *   2.5x ATR stop, or a close back below the 100-day EMA.
 * When it does NOT work: in a melt-up where price breaks out while hashrate
 *   lags behind (it is slow-moving daily data), the filter keeps it in cash and
 *   it misses the rally. Hashrate is bitcoin-only, so the gate is shared by all
 *   five coins.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // On-chain confirmation: mining network expanding vs its own 30d average.
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const netGrowing = hr != null && hrSma != null && hrSma > 0 && hr > hrSma;

  const pos = ctx.pos(sym);

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'hashrate > its 30d avg', ok: netGrowing, closed: true },
                       { label: 'close > 100-EMA', ok: prevClose > ema100, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (!netGrowing) return null;

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
