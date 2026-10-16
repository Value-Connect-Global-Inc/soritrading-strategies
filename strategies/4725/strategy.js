/*
 * @coinsori-strategy v1
 * name: FedLiquidityLong4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a liquidity asset — it rallies when the Fed is
 * cutting rates or holding them near zero (fiat liquidity flows into risk) and
 * suffers when the Fed hikes. This is a macro-regime strategy, a different
 * family from price-only timing, which keeps failing the recent choppy market.
 * When it buys and sells: buys while the Fed is CUTTING (rate now below its
 * value 30 days ago) OR rates are very low (<1%, the zero-rate bull era), AND
 * price is above its 200-SMA (trend intact). Holds through normal pullbacks and
 * sells only when the Fed starts HIKING, rates climb above 3%, or a wide 4x ATR
 * stop loss hits. Long only.
 * When it does NOT work: if the Fed sits on hold at mid rates for a long flat
 * year while crypto grinds sideways, it holds cash and misses the grind-up. It
 * cannot profit from a bull that runs while rates are unchanged and above 1%.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed bar
  const fed = ctx.data('fed');             // Fed funds rate now
  const fedLag = ctx.data('fed_lag30');    // Fed funds rate 30 days ago
  if (price == null || fed == null || fedLag == null) return null;

  const easing = fed < fedLag;              // rate LOWER now than 30 days ago = cutting
  const hiking = fed > fedLag;              // rate HIGHER now than 30 days ago = hiking
  const loose = fed < 1.0;                  // near-zero rates = maximum liquidity (2020-21 bull era)
  const tight = fed > 3.0;                  // clearly restrictive policy
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  // wide stop for a multi-month hold: 4x ATR (~6-8%), so normal pullbacks don't shake it out
  const stopDist = 4 * atr;

  // ---- exits first ----
  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx - stopDist;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'4xATR stop' }]);
    if (hiking || tight || price < stop) return { side:'sell', qty: ctx.position };
    return null;
  }

  // ---- entry: accommodative Fed (cutting or near-zero) + price above 200-SMA ----
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if ((easing || loose) && price > sma200) {
    // risk 2% of cash: qty = risk / stopDist, capped at 4x notional
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 4 / ctx.price);
    ctx.watch([{ side:'buy', note:'Fed accommodative + above SMA200', conds:[
      { label:'Fed cutting or <1%', ok: easing || loose },
      { label:'price > SMA200', ok: price > sma200 }
    ]}]);
    return { side:'buy', qty };
  }
  return null;
}
