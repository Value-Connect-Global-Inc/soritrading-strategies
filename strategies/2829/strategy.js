/*
 * @coinsori-strategy v1
 * name: Composite On-Chain Demand BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Two independent on-chain fundamentals — active network
 * addresses (user demand) and miner hashrate (producer commitment) — each rise
 * in healthy bull phases and stall or fall in capitulation. Requiring BOTH to
 * confirm is a stronger, more selective signal than either alone, and selling
 * when EITHER turns down exits faster than a single-signal version. A short
 * cooldown after each exit prevents re-entry whipsaw when the signals flicker.
 * When it buys and sells: holds Bitcoin only while BOTH the 30-day-smoothed
 * active-address count AND the 30-day-smoothed hashrate are rising vs ~30 days
 * earlier. Sells to cash when EITHER signal turns down, then waits a cooldown
 * before re-entering.
 * When it does NOT work: on-chain data is daily and lags price, so in a sharp
 * V-shaped melt-up it re-enters late and trails buy-and-hold; and requiring both
 * signals means it is fully out during mixed regimes where only one is rising.
 */
// 2026-04-26 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const addr = Number(ctx.data('addr_sma30'));
  const hr = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(addr) || addr <= 0) {
    ctx.watch([]);
    return null;
  }
  if (!Number.isFinite(hr) || hr <= 0) {
    ctx.watch([]);
    return null;
  }

  // Rolling history of both smoothed series for the "vs ~30 bars ago" comparison.
  const st = ctx.state;
  if (!st.aHist) st.aHist = [];
  if (!st.hHist) st.hHist = [];
  st.aHist.push(addr);
  st.hHist.push(hr);
  if (st.aHist.length > 30) st.aHist.shift();
  if (st.hHist.length > 30) st.hHist.shift();
  if (st.aHist.length < 30 || st.hHist.length < 30) {
    ctx.watch([]);
    return null;
  }
  const aPast = st.aHist[0];
  const hPast = st.hHist[0];

  // Hysteresis band on the smoothed series (1%) — fewer, more decisive flips.
  const aRising = addr > aPast * 1.01;
  const aFalling = addr < aPast * 0.99;
  const hRising = hr > hPast * 1.01;
  const hFalling = hr < hPast * 0.99;

  // Cooldown after each exit to avoid re-entry whipsaw (10 bars).
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  // Declare what we are waiting for (display only).
  if (pos > 0) {
    ctx.watch([
      {
        side: 'sell',
        qty: pos,
        conds: [
          { label: 'Addr SMA30 falling', ok: aFalling },
          { label: 'Hashrate SMA30 falling', ok: hFalling }
        ],
        note: 'Exit on on-chain weakness'
      }
    ]);
  } else {
    const entryNote = cd > 0 ? 'Entry: cooldown + both signals' : 'Entry: both on-chain signals rising';
    ctx.watch([
      {
        side: 'buy',
        conds: [
          { label: 'Cooldown over', now: cd, op: '<=', ref: 0 },
          { label: 'Addr SMA30 rising', ok: aRising },
          { label: 'Hashrate SMA30 rising', ok: hRising }
        ],
        note: entryNote
      }
    ]);
  }

  if (pos > 0) {
    if (aFalling || hFalling) {
      st.cd = 10;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (cd > 0) return null;
  if (aRising && hRising) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
