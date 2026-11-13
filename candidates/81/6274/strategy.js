/*
 * @coinsori-strategy v1
 * name: OnChain Adoption Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage — the daily count of unique active
 * addresses — is a fundamental adoption signal that tends to lead or confirm
 * price trends. When usage is expanding (addresses above their own recent
 * average) while price is in an uptrend, the move has real demand behind it;
 * when usage contracts, the rally is on thin air. This is an on-chain
 * fundamental family, different from sentiment and from price-only trend.
 * When it buys and sells: it buys when the active-address reading is above its
 * trailing average (usage expanding) AND the 4h close is above its 200-bar
 * average. It sells when usage drops below its average (demand fading), the
 * close falls below the 200-bar average, or price drops 5xATR below the best
 * high since entry.
 * When it does NOT work: in a pure liquidity-driven rally with no on-chain
 * confirmation it stays flat and misses the move; the daily data is slow so it
 * lags fast reversals. If the on-chain data is missing it stays flat.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const addr = ctx.data('main.addr');

  // Distinct daily observations (addresses update once a day, repeat across 4h bars).
  const hist = ctx.state.addrHist || [];
  if (addr != null && addr > 0) {
    const last = hist[hist.length - 1];
    if (last == null || Math.abs(last - addr) > 1e-9) {
      hist.push(addr);
      if (hist.length > 90) hist.shift(); // ~3 months of daily obs
      ctx.state.addrHist = hist;
    }
  }
  // Use only SETTLED observations (drop the newest, possibly forming one).
  const n = hist.length;
  const settled = hist.slice(0, n - 1);
  let usageUp = null; // null = unknown
  if (settled.length >= 20) {
    const m = settled.reduce((a, b) => a + b, 0) / settled.length;
    const cur = hist[n - 2];
    if (cur != null) usageUp = cur > m * 1.01; // 1% above its own average = expanding
  }

  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    const stop = atrNow != null ? hh - 5 * atrNow : sma200 * 0.9;
    const exitPx = Math.max(sma200 * 0.97, stop);
    const usageExit = usageUp === false;
    ctx.watch([
      { side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/stop exit' },
      { side: 'sell', price: price, trigger: 'below', note: 'Usage fading exit', conds: [{ label: 'usage expanding', ok: usageUp === true }] }
    ]);
    if (usageExit || prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  // Adoption expanding + confirmed uptrend.
  if (usageUp === true && prevClose > sma200) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    // Risk 4% of equity over the 5xATR stop distance, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) qty = Math.min(qty, (ctx.cash * 0.04) / (5 * atrNow));
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Usage up + uptrend', conds: [{ label: 'usage expanding', ok: true }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Usage up + uptrend', conds: [{ label: 'usage expanding', ok: usageUp === true }] }]);
  return null;
}
