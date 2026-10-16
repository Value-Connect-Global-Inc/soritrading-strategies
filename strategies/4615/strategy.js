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
 * broken) or a hard 20% stop-loss from the entry price is hit.
 * When it does NOT work: in a mature bull where price keeps climbing but
 * on-chain activity plateaus (addresses/hash rate stop expanding), the filter
 * keeps us out of the final leg. In a sharp crash the 200-day gate is slow to
 * flip and the stop-loss takes the damage. The daily data series start later
 * than price, so the first bars of history have no fundamental signal.
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
    const entry = ctx.entryPx;
    // Hard 20% stop from entry caps the loss on any single position; the 200-day
    // trend gate exits when the longer regime turns. 20% is wide enough not to be
    // shaken out by normal pullbacks but caps the worst case.
    const stopPx = entry != null ? entry * 0.80 : price * 0.80;
    if (price <= sma200 || price <= stopPx) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop 20%' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend gate' }]);
    return null;
  }

  // Entry needs the trend intact AND both fundamentals expanding.
  if (price <= sma200 || !usageUp || !hashUp) return null;

  // Size: risk a small share of cash; with a 20% stop this gives roughly 5%
  // of the account at risk per position, which is sane for a single asset.
  const riskCash = ctx.cash * 0.05;
  const stopDist = price * 0.20;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
