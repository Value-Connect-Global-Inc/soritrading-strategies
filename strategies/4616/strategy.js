/*
 * @coinsori-strategy v1
 * name: Fed Policy Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: monetary policy direction drives risk appetite for
 * crypto. When the Fed is cutting rates, liquidity flows into risk assets and
 * BTC tends to trend up; when it is hiking, liquidity drains and BTC falls.
 * The Fed funds rate series (fed) compared to its 30-day-lagged value
 * (fed_lag30) tells us the policy direction — this is slow-moving, so the
 * strategy does not churn like the on-chain data did.
 * When it buys and sells: buy BTC when price is above its 200-day average AND
 * the Fed is easing (fed below its 30-day-lagged value). Sell when price falls
 * below its 200-day average or the Fed turns to hiking (fed above its lag).
 * When it does NOT work: in a bull run that happens while the Fed holds rates
 * steady (no cut, no hike) the easing gate stays off and we miss the move —
 * this is exactly the 2020-2021 zero-rate era. In a bear caused by something
 * other than monetary policy (e.g. exchange collapse), the gate does not help.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  const sma200 = ctx.sma(200, 1);
  if (fed == null || fedLag == null || sma200 == null) return null;

  // Easing = current rate below its level 30 days ago (cutting). Hiking = above.
  const easing = fed < fedLag;
  const hiking = fed > fedLag;

  const pos = ctx.position;
  if (pos > 0) {
    if (price <= sma200 || hiking) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend gate' }]);
    return null;
  }

  if (price <= sma200 || !easing) return null;

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
