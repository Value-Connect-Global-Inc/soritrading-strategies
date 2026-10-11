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
 * strategy holds BTC only while the network is growing and sits in cash when it is shrinking.
 * When it buys and sells: Buys BTC when the 30-day average of daily active addresses is at least
 * 2% higher than it was 90 days ago. Sells to cash when that average is at least 2% lower than
 * 90 days ago. The 2% band stops noise from flipping the position back and forth.
 * When it does NOT work: The signal is slow — it can enter after a rally has already started and
 * exit after a top, so a fast crash gives back gains before the exit fires. In flat sideways
 * markets with flat network growth it sits in cash and misses small rallies.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr_sma30'); // 30-day average of active addresses, precomputed in SQL
  if (addr == null) return null; // no on-chain data yet

  // keep a rolling history of the 30-day average so we can compare against 90 days ago
  const hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 500) hist.shift();
  ctx.state.addrHist = hist;

  if (hist.length < 91) return null; // need 90 days of history

  const past = hist.at(-91); // 30-day average ~90 days ago
  const pos = ctx.position;
  if (pos > 0) {
    // exit only when network clearly shrinking (2% band avoids whipsaw)
    if (addr < past * 0.98) return { side: 'sell', qty: pos };
    return null;
  }
  // enter only when network clearly growing (2% band avoids noise flips)
  if (addr > past * 1.02) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
