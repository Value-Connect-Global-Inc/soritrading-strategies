/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Trend 1D (BTC/ETH/SOL)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Momentum persists in crypto large-caps — an asset that has risen over the
 * last 90 days tends to keep rising. This strategy rides that momentum on each of the three big
 * assets independently, only inside a 200-day uptrend so it steps aside in broad bears.
 * When it buys and sells: on each asset, buys when the trailing 90-day return is positive AND
 * price closes above the 200-day average. Sells when a closed bar closes below the 200-day average.
 * Position per asset is capped at one third of equity.
 * When it does NOT work: in a choppy sideways market the 200-day gate whipsaws; in a sharp
 * reversal it gives back the move before the 200-day exit fires. It misses the first leg of a
 * new uptrend (needs 90 days of positive momentum to enter).
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 202) return null;

  const prevClose = c.at(-2); // last CLOSED bar
  const pos = ctx.pos(sym);

  // 200-day average from closes (documented array)
  let s = 0;
  for (let k = 2; k <= 201; k++) s += c[c.length - k];
  const sma200 = s / 200;

  if (pos > 0) {
    // exit: closed bar below the 200-day average (trend broken)
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d SMA breakdown' }]);
    return null;
  }

  // momentum: 90-day return of the last closed bar
  const then = c.at(-2 - 90);
  if (then == null || then <= 0) return null;
  const mom = prevClose / then - 1;
  const trendUp = prevClose > sma200;

  if (!(mom > 0 && trendUp)) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d SMA reclaim',
                 conds: [{ label: '90d mom>0', ok: mom > 0, closed: true }] }]);
    return null;
  }

  // one third of equity per asset (3 assets = full basket)
  const qty = (ctx.cash * 0.99 / price) / 3;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d SMA reclaim',
               conds: [{ label: '90d mom>0', ok: mom > 0, closed: true }] }]);
  return { side: 'buy', qty };
}
