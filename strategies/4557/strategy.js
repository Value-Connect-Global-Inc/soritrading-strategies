/*
 * @coinsori-strategy v1
 * name: BTC-ETH Relative Strength Rotation (1D)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a rising crypto market one asset usually leads. Holding
 * the stronger of BTC vs ETH, and switching when their 90-day momentum flips,
 * captures the leading asset's trend while avoiding holding the laggard through
 * a drawdown. Cross-sectional relative strength, implemented via a shared
 * ctx.state ring buffer of each symbol's price (ctx.market gives only a live
 * price, no history, so we record our own history per symbol).
 * When it buys and sells: each day, compare BTC's and ETH's 90-day price change.
 * Hold the one with higher momentum; if flat and that one is this symbol, buy it;
 * if holding the laggard, sell it. 15% hard stop on every position.
 * When it does NOT work: when both assets fall together (a coordinated bear), the
 * rotation is fully flat and safe but buys nothing; in a choppy market where the
 * lead flips every few weeks, rotation churns and pays fees without adding value.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const sym = ctx.sym;
  const syms = ctx.syms;
  if (!syms || syms.length < 2) return null;

  const LOOK = 90; // momentum lookback in bars

  // Record this symbol's price into a shared ring buffer (ctx.state persists and
  // is shared across all symbols in the run). We need ~LOOK+2 samples.
  const st = ctx.state;
  if (!st.px) st.px = {};
  if (!st.px[sym]) st.px[sym] = [];
  const buf = st.px[sym];
  buf.push(price);
  if (buf.length > LOOK + 5) buf.shift();

  function momentumSeries(arr) {
    if (!arr || arr.length < LOOK + 2) return null;
    const now = arr[arr.length - 1];
    const then = arr[arr.length - LOOK - 1];
    if (!Number.isFinite(now) || !Number.isFinite(then) || then <= 0) return null;
    return (now - then) / then;
  }

  // Own momentum from the reliable own-series; other symbol's from the ring buffer.
  const ownArr = ctx.closes;
  let ownMom = null;
  if (Array.isArray(ownArr) && ownArr.length >= LOOK + 3) {
    const now = ownArr[ownArr.length - 2];
    const then = ownArr[ownArr.length - 2 - LOOK];
    if (Number.isFinite(now) && Number.isFinite(then) && then > 0) ownMom = (now - then) / then;
  }

  const other = syms.find(s => s !== sym) || null;
  const otherMom = other ? momentumSeries(st.px[other]) : null;

  if (ownMom == null || otherMom == null) return null;

  const best = ownMom >= otherMom ? sym : other;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85; // 15% hard stop
    if (price <= stop) return { side: 'sell', qty: pos };
    if (best !== sym) return { side: 'sell', qty: pos }; // laggard -> rotate out
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' }]);
    return null;
  }

  if (best !== sym) return null; // only the strongest buys
  if (ownMom <= 0) return null;  // no positive momentum -> stay flat

  const qty = (ctx.cash * 0.98) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
