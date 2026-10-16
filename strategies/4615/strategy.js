/*
 * @coinsori-strategy v1
 * name: Onchain Expansion Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: on-chain usage and network hash rate are a genuinely
 * different axis from price or sentiment. The bet is that a healthy bull
 * regime is confirmed by real network activity growing (more active addresses
 * and more hash rate) on top of an intact price trend — so we only hold BTC
 * when the fundamentals confirm the trend. This avoids buying purely on price
 * momentum that the network is not backing.
 * When it buys and sells: buy BTC when price is above its 200-day average AND
 * active addresses are above their 30-day average AND hash rate is above its
 * 30-day average. Sell when price falls below its 200-day average (trend
 * broken). Full position while the regime is on, flat while it is off.
 * When it does NOT work: in a mature bull where price keeps climbing but
 * on-chain activity plateaus (addresses/hash rate stop expanding), the filter
 * keeps us out of the final leg. In a sharp crash the 200-day gate is slow to
 * flip and we ride the drawdown down. The daily data series start later than
 * price, so the first bars of history have no fundamental signal.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Daily data: read on-chain signals from the closed bar so they are stable.
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const sma200 = ctx.sma(200, 1);
  if (addr == null || addrSma == null || hr == null || hrSma == null || sma200 == null) return null;

  // Fundamental expansion: usage and hash rate both above their 30-day mean.
  // Using the 30-day average smooths the daily noise; a fixed threshold would
  // break as the network grows over years.
  const usageUp = addr > addrSma;
  const hashUp = hr > hrSma;

  const pos = ctx.position;
  if (pos > 0) {
    // Regime exit only: the 200-day trend gate. No tight stop — a regime
    // strategy on daily bars should not be shaken out by normal pullbacks.
    if (price <= sma200 || !usageUp || !hashUp) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'trend gate' }]);
    return null;
  }

  // Entry needs the trend intact AND both fundamentals expanding.
  if (price <= sma200 || !usageUp || !hashUp) return null;

  // Full position while the regime is on — this is a regime switch, not a
  // risk-managed swing, so we want the exposure the regime is paying for.
  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
