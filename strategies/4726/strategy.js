/*
 * @coinsori-strategy v1
 * name: FedLiquidityLong4h v2
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a liquidity asset — it rallies when the Fed is
 * cutting rates (fiat liquidity flows into risk) and also when rates sit pinned
 * at the effective lower bound (maximum liquidity, the 2020-21 zero-rate bull).
 * It suffers when the Fed hikes. This is a macro-regime strategy, a different
 * family from price-only timing, which keeps failing the recent choppy market.
 * When it buys and sells: buys while the Fed funds rate is FALLING (rate now
 * below its value 30 days ago) OR pinned near zero (below 0.5%), AND price is
 * above its 200-SMA with that SMA rising (trend intact). Holds through normal
 * pullbacks. Sells when the Fed starts HIKING again (outside the zero-rate
 * regime), the 200-SMA turns down, or a trailing 4x ATR stop (highest close
 * since entry minus 4x ATR) is hit. Long only.
 * When it does NOT work: if the Fed sits on hold at a mid level (say 2-4%)
 * while crypto grinds sideways or runs up, it holds cash and misses it. A
 * strong bull that runs while rates are unchanged gives back part of its gains
 * to the trailing stop before the trend rolls over. It cannot profit from a
 * downtrend (long only).
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed bar
  const fed = ctx.data('fed');             // Fed funds rate now
  const fedLag = ctx.data('fed_lag30');    // Fed funds rate 30 days ago
  if (price == null || fed == null || fedLag == null) return null;

  const easing = fed < fedLag;              // rate LOWER now than 30 days ago = cutting
  const hiking = fed > fedLag;              // rate HIGHER now than 30 days ago = hiking
  const zeroRate = fed < 0.5;               // effective lower bound = max liquidity (2020-21)

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 4 * atr;                 // wide stop for a multi-month hold

  const sma200 = ctx.sma(200, 1);
  const smaPrev = ctx.sma(200, 2);
  if (sma200 == null || smaPrev == null) return null;
  const trendUp = sma200 > smaPrev;         // 200-SMA rising = uptrend intact

  // ---- exits first ----
  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const st = ctx.state || {};
    // trailing high = highest close since entry, so a big run does not give
    // back the whole move before the stop fires
    if (st.hi == null || price > st.hi) st.hi = price;
    const stop = st.hi - stopDist;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'trailing 4xATR stop' }]);
    if ((hiking && !zeroRate) || !trendUp || price < stop) {
      st.hi = null;
      return { side:'sell', qty: ctx.position };
    }
    return null;
  }

  // ---- entry: Fed easing OR zero-rate (liquidity) + uptrend confirmed ----
  const liquid = easing || zeroRate;
  if (liquid && price > sma200 && trendUp) {
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 4 / ctx.price);
    const st = ctx.state || {};
    st.hi = price;
    ctx.watch([{ side:'buy', note:'Fed liquidity + uptrend', conds:[
      { label:'Fed cutting or zero-rate', ok: liquid },
      { label:'price > SMA200', ok: price > sma200 },
      { label:'SMA200 rising', ok: trendUp }
    ]}]);
    return { side: 'buy', qty };
  }
  return null;
}
