/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Network Health Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's mining hashrate is a proxy for network health and miner confidence. When it rises above its 30-day average, the network is strengthening and BTC tends to trend up; when it falls below, the network is weakening.
 * When it buys and sells: Buys when hashrate crosses above its 30-day average (and stays in while it is above). Sells when hashrate crosses back below that average.
 * When it does NOT work: Long choppy periods where hashrate and price disconnect, or a bear market where hashrate stays high while price falls (e.g. miner capitulation lags price). Expect drawdowns in those regimes.
 * 2025-01-01: display-only change, trading decisions unchanged.
 */
function onUpdate(ctx) {
  // External on-chain data: null = unknown, never trade on unknown.
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr == null || hrSma == null) return null;

  const holding = ctx.position > 0;

  // Declare what we're waiting for (display only, no orders).
  if (holding) {
    // Position open: waiting for exit signal (hashrate falls below its 30-day avg).
    ctx.watch([{ side: 'sell', price: hrSma, trigger: 'below', note: 'Hashrate < SMA30 exit', conds: [{ label: 'Hashrate', now: hr, op: '<', ref: hrSma, closed: true }] }]);
  } else {
    // No position: waiting for entry signal (hashrate rises above its 30-day avg).
    ctx.watch([{ side: 'buy', price: hrSma, trigger: 'above', note: 'Hashrate > SMA30 entry', conds: [{ label: 'Hashrate', now: hr, op: '>', ref: hrSma, closed: true }] }]);
  }

  if (!holding && hr > hrSma) {
    // Network health improving -> enter long.
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  if (holding && hr < hrSma) {
    // Network health deteriorating -> exit long.
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
