/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Hashrate Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On-chain network strength (hashrate) reflects miner
 *   confidence and historically confirms bull regimes. When hashrate is above
 *   its own 30-period average AND price is above the 200-EMA, the uptrend is
 *   backed by real network expansion, not just speculation.
 * When it buys and sells: buys and holds BTC while price > EMA200 AND
 *   hashrate > hashrate_sma30 (both confirmed on closed bars). Sells when
 *   price closes below EMA200 — the trend is broken regardless of hashrate.
 * When it does NOT work: hashrate is a slow, coincident/lagging signal — in
 *   short sharp bull spikes it confirms late, and in chop around EMA200 it
 *   whipsaws. It also stays flat in low-vol sideways regimes.
 */
function onUpdate(ctx) {
  const s = ctx.ema(200, 1);
  if (s == null) return null;
  const price = ctx.price;

  if (ctx.position > 0) {
    // trend broken: exit on close below the 200-EMA
    if (price < s) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: s, trigger: 'below', note: 'EMA200 trend break' }]);
    return null;
  }

  // regime: on-chain network strength above its own 30-period average
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr == null || hrSma == null) return null; // data missing — stay flat
  if (hr <= hrSma) return null; // miners not expanding — no bull confirmation

  // trend: price above the 200-EMA
  if (price <= s) return null;

  const qty = (ctx.cash * 0.5) / price; // half the cash per signal, capped risk
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: s, trigger: 'above', note: 'EMA200 + hashrate bull', conds: [
    { label: 'hashrate>sma30', ok: hr > hrSma }
  ]}]);
  return { side: 'buy', qty };
}
