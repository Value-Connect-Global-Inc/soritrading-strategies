/*
 * @coinsori-strategy v1
 * name: BTC 1D On-Chain Network-Health Trend
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC's on-chain activity (daily active addresses) is a
 * network-health fundamental. When the number of active addresses is growing,
 * real users are transacting and the network is expanding — historically a
 * supportive backdrop for price. This is an on-chain family, different from
 * price-only mean reversion and from sentiment. It uses the user's own
 * active-addresses dataset (verified available).
 * When it buys and sells: Enters long when the 30-day average of active
 * addresses is rising (network expanding) AND price is above its 200-day
 * average (trend intact). Exits when the address trend turns down (network
 * contracting) or price breaks below the 50-day average. Otherwise in cash.
 * When it does NOT work: Active addresses can rise while price is flat or
 * falling (network use is not the same as price momentum), and address growth
 * lags price moves. In a bull market driven purely by speculation with flat
 * on-chain activity, this stays out and underperforms.
 *
 * 2024-01-01: display-only changes — added ctx.watch declarations. Trading decisions unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain network health from the user's own dataset.
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const sma50 = ctx.sma(50, 1);
  if (addr == null || addrSma == null || sma200 == null || sma50 == null) return null;

  // Network expanding = current addresses above the 30-day average.
  const networkGrowing = addr > addrSma;
  const uptrend = sma200prev != null && sma200 > sma200prev;

  if (pos > 0) {
    // Exit when the network contracts or price breaks the 50-day trend.
    if (!networkGrowing || price < sma50) {
      ctx.watch([
        { side: 'sell', price: sma50, trigger: 'below', note: 'break SMA50', conds: [
          { label: 'addr > SMA30', ok: networkGrowing }
        ]}
      ]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'break SMA50', conds: [
        { label: 'addr > SMA30', ok: networkGrowing }
      ]}
    ]);
    return null;
  }

  // Enter only when both network and price trend are healthy.
  if (uptrend && networkGrowing) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'below', note: 'SMA200 support', conds: [
        { label: 'addr > SMA30', ok: networkGrowing },
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  ctx.watch([]);
  return null;
}
