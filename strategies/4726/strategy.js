/*
 * @coinsori-strategy v1
 * name: FedLiquidityLong4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a liquidity asset — it rallies when the Fed is
 * cutting rates (fiat liquidity flows into risk) and suffers when the Fed hikes.
 * This is a macro-regime strategy, a different family from price-only timing,
 * which keeps failing the recent choppy market.
 * When it buys and sells: buys while money is cheap — the Fed is CUTTING rates,
 * OR the rate is pinned near zero (0.5% or below, maximum liquidity even when
 * flat) — AND price is above its 200-SMA (trend intact). Holds through normal
 * pullbacks and sells only when the Fed starts HIKING again or a wide 4x ATR
 * stop loss hits. Long only.
 * When it does NOT work: if the Fed sits on hold at a HIGH rate (e.g. 4-5%)
 * for a long stretch while crypto grinds sideways or runs up, it holds cash and
 * misses it. It is defensive by design — it will not capture a bull that runs
 * while rates are high and unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed bar
  const fed = ctx.data('fed');             // Fed funds rate now
  const fedLag = ctx.data('fed_lag30');    // Fed funds rate 30 days ago
  if (price == null || fed == null || fedLag == null) return null;

  const easing = fed < fedLag;              // rate LOWER now than 30 days ago = cutting
  const hiking = fed > fedLag;              // rate HIGHER now than 30 days ago = hiking
  const zeroBound = fed < 0.5;              // pinned near zero = maximum liquidity even if flat
  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  // wide stop for a multi-month hold: 4x ATR (~6-8%), so normal pullbacks don't shake it out
  const stopDist = 4 * atr;

  // ---- exits first ----
  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx - stopDist;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'4xATR stop' }]);
    if (hiking || price < stop) return { side:'sell', qty: ctx.position };
    return null;
  }

  // ---- entry: cheap money (cutting OR zero-bound) + price above its 200-SMA ----
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const cheapMoney = easing || zeroBound;
  if (cheapMoney && price > sma200) {
    // risk 2% of cash: qty = risk / stopDist, capped at 4x notional
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 4 / ctx.price);
    ctx.watch([{ side:'buy', note:'Cheap money + above SMA200', conds:[
      { label:'Fed cutting (30d)', ok: easing },
      { label:'Rate near zero', ok: zeroBound },
      { label:'price > SMA200', ok: price > sma200 }
    ]}]);
    return { side: 'buy', qty };
  }
  return null;
}
