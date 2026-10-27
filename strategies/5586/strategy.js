/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A different family from volume/on-chain flow — a macro
 * volatility regime filter. The VIX (US stock fear gauge, FRED base_vix) is a
 * signal price alone cannot see: when global markets are panicking (VIX spiking),
 * crypto drawdowns tend to coincide. Hypothesis: staying long BTC only while the
 * 200d trend is up AND the VIX is calm keeps us in the bull and out of the worst
 * risk-off crashes, without needing to predict the crash itself.
 * When it buys and sells: Buys when price is above its 200d average (confirmed
 * long-term uptrend) AND VIX is below a calm threshold (25). Sells when price
 * falls back below the 200d average OR VIX spikes above a panic threshold (35).
 * Two thresholds create a band so we do not churn on small VIX moves.
 * When it does NOT work: VIX is a US-equity gauge with a 2-day lag, so it can
 * stay calm while crypto has its own idiosyncratic selloff; and in a long steady
 * bull with a quietly rising VIX it may exit too early. It also misses the
 * explosive early phase of a new bull because VIX is still elevated from the
 * prior crash.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // 200d trend gate: only hold longs in a confirmed bull regime.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // VIX from FRED, lagged 2 days so it is knowable at decision time.
  const vix = ctx.data("base_vix");
  const vixOk = vix != null && Number.isFinite(vix) && vix > 0;

  const st = ctx.state || {};

  if (pos > 0) {
    // Exit on trend break OR VIX panic (above 35). Declare both so the card shows them.
    const watch = [{ side: 'sell', price: sma200, trigger: 'below', note: '200d break' }];
    if (vixOk) watch.push({ side: 'sell', price: 35, trigger: 'above', note: 'VIX panic' });
    ctx.watch(watch);

    if (price < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (vixOk && vix > 35) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Enter only when trend up AND VIX calm (below 25). The 25/35 band stops churn.
  if (price > sma200 && vixOk && vix < 25) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d up + VIX calm',
                 conds: [{ label: 'VIX<25', now: vix, op: '<', ref: 25, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
