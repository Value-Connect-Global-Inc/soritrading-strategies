/*
 * @coinsori-strategy v1
 * name: BTC Network-Growth Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's real adoption shows up on-chain — the number of active addresses.
 * Network usage tends to lead price: usage climbs before rallies and falls before crashes. This
 * strategy holds BTC only while the network is growing (30-day average of active addresses above
 * its level 90 days ago) and sits in cash when it is shrinking, so it rides bull markets on
 * fundamentals and steps aside for bear markets.
 * When it buys and sells: Buys BTC when the 30-day average of daily active addresses is higher
 * than it was 90 days ago. Sells to cash when that average is lower than 90 days ago.
 * When it does NOT work: The signal is slow — it can enter after a rally has already started and
 * exit after a top, so a fast crash gives back gains before the exit fires. In flat sideways
 * markets with flat network growth it whipsaws between small positions.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  if (addr == null) return null; // no on-chain data yet

  // keep a rolling history of daily active addresses
  const hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 500) hist.shift();
  ctx.state.addrHist = hist;

  // need 30 days to form the average plus 90 days to compare against
  if (hist.length < 120) return null;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const cur = avg(hist.slice(-30)); // recent network activity
  const past = avg(hist.slice(-120, -90)); // network activity ~90 days ago
  const growing = cur > past;

  const pos = ctx.position;
  if (pos > 0) {
    if (!growing) return { side: 'sell', qty: pos };
    return null;
  }
  if (growing) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
