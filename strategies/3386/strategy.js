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
 *
 * 2026-04-13: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const addr = ctx.data('addr_sma30'); // 30-day average of active addresses, precomputed in SQL
  if (addr == null) {
    ctx.watch([]); // 아직 온체인 데이터 없음 — 기다릴 가격/시간 조건 없음
    return null;
  }

  // keep a rolling history of the 30-day average so we can compare against 90 days ago
  const hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 500) hist.shift();
  ctx.state.addrHist = hist;

  if (hist.length < 91) {
    ctx.watch([]); // 90일치 이력이 쌓일 때까지 대기 — 가격/시간 조건 없음
    return null;
  }

  const past = hist.at(-91); // 30-day average ~90 days ago
  const pos = ctx.position;
  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      note: 'network shrink exit',
      conds: [{ label: 'addr_sma30 < past*0.98', now: addr, op: '<', ref: past * 0.98 }]
    }]);
    // exit only when network clearly shrinking (2% band avoids whipsaw)
    if (addr < past * 0.98) return { side: 'sell', qty: pos };
    return null;
  }

  ctx.watch([{
    side: 'buy',
    note: 'network growth entry',
    conds: [{ label: 'addr_sma30 > past*1.02', now: addr, op: '>', ref: past * 1.02 }]
  }]);
  // enter only when network clearly growing (2% band avoids noise flips)
  if (addr > past * 1.02) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
