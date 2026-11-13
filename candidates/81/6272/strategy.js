/*
 * @coinsori-strategy v1
 * name: Funding Squeeze Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: perpetual funding rate is a direct read on crowd positioning.
 * When funding is far below its own recent average (shorts paying longs), the crowd
 * is crowded short — in an uptrend that fuel often squeezes. This is a positioning
 * sentiment edge, a different family from the VIX/ATR regime trend strategy.
 * When it buys and sells: it buys only when the funding z-score is below -1.5 (an
 * EXTREME crowded-short reading) AND the 4h close is above its 200-bar average. It
 * sells when the funding z-score turns positive (crowd long again), the close falls
 * below the 200-bar average, or price drops 5xATR below the best high since entry.
 * When it does NOT work: in a falling market a crowded-short bounce is just a
 * dead-cat bounce and the trend filter is the only protection; and if funding
 * history is missing (early data) it simply stays flat.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const funding = ctx.funding;

  // Accumulate distinct funding observations (8h intervals repeat across 4h bars).
  const hist = ctx.state.fundHist || [];
  if (funding != null && isFinite(funding)) {
    const last = hist[hist.length - 1];
    if (last == null || Math.abs(last - funding) > 1e-9) {
      hist.push(funding);
      if (hist.length > 120) hist.shift();
      ctx.state.fundHist = hist;
    }
  }
  // Use only SETTLED funding values (drop the newest, possibly forming observation).
  const n = hist.length;
  const settled = hist.slice(0, n - 1);
  let fz = null;
  if (settled.length >= 30) {
    const m = settled.reduce((a, b) => a + b, 0) / settled.length;
    const sd = Math.sqrt(settled.reduce((a, b) => a + (b - m) * (b - m), 0) / settled.length) || 1e-6;
    const fUse = hist[n - 2];
    if (fUse != null) fz = (fUse - m) / sd;
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
    const exitFunding = fz != null && fz > 0.5;
    ctx.watch([
      { side: 'sell', price: exitPx, trigger: 'below', note: 'Trend/stop exit' },
      { side: 'sell', price: price, trigger: 'below', note: 'Crowd long exit', conds: [{ label: 'funding z', now: fz, op: '>', ref: 0.5 }] }
    ]);
    if (exitFunding || prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  // Only EXTREME crowded-short readings: z below -1.5 filters weak signals.
  if (fz != null && fz < -1.5 && prevClose > sma200) {
    ctx.state.hh = price;
    const atrNow = ctx.atr(14, 1);
    // Risk 4% of equity over the 5xATR stop distance, capped at full cash.
    let qty = ctx.cash / price * 0.99;
    if (atrNow != null && atrNow > 0) qty = Math.min(qty, (ctx.cash * 0.04) / (5 * atrNow));
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Uptrend + extreme short', conds: [{ label: 'funding z', now: fz, op: '<', ref: -1.5 }] }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Uptrend + extreme short', conds: [{ label: 'funding z', now: fz, op: '<', ref: -1.5 }] }]);
  return null;
}
