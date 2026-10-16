/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Network health (hashrate) is a slow, smooth signal of
 * miner confidence. When the network is expanding (hashrate above its 30-day
 * average) and price is above its 200-day average, bitcoin tends to be in a
 * healthy uptrend. This is a different family from price-only breakout
 * following — it bets on a fundamental regime, not on a breakout.
 * When it buys and sells: buy when hashrate is above its 30-day average AND
 * price is above the 200-day SMA. Sell when hashrate falls below its 30-day
 * average, price breaks the 200-day SMA, or a 30% stop is hit.
 * When it does NOT work: hashrate lags price — it keeps rising for a while
 * after a top and keeps falling after a bottom, so entries and exits are
 * late. In a long shallow bear market where miners never capitulate, the
 * signal can stay long while price drifts down.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);

  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr == null || hrSma == null) return null;   // dataset missing -> no trade, never assume

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // 30% hard stop: protects capital if the regime signal misreads
    const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.70;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (hr < hrSma || prevClose < sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 break' }]);
    return null;
  }

  if (hr > hrSma && prevClose > sma200) {
    const qty = (ctx.cash * 0.95 / price) * 0.95;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'regime long',
                 conds: [{ label: 'hashrate > its 30d avg', ok: hr > hrSma, closed: true }] }]);
    return { side: 'buy', qty };
  }
  return null;
}
