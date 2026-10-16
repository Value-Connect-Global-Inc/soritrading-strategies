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
 * When it buys and sells: buys while the Fed funds rate is FALLING (rate now
 * below its value 30 days ago) — the wide 4x ATR stop is the risk control.
 * Sells when the Fed starts HIKING again or the stop loss hits. Long only.
 * When it does NOT work: if the Fed sits on hold (rate unchanged) for a long
 * year while crypto grinds sideways or runs up, it holds cash and misses it —
 * notably the 2020-2021 zero-rate bull, where the rate was flat at ~0% so the
 * 'cutting' signal never fired. It cannot profit from a bull that runs while
 * rates are unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed bar
  const fed = ctx.data('fed');             // Fed funds rate now
  const fedLag = ctx.data('fed_lag30');    // Fed funds rate 30 days ago
  if (price == null || fed == null || fedLag == null) return null;

  const easing = fed < fedLag;              // rate LOWER now than 30 days ago = cutting
  const hiking = fed > fedLag;              // rate HIGHER now than 30 days ago = hiking
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

  // ---- entry: Fed easing (liquidity), wide stop is the risk control ----
  if (easing) {
    // risk 2% of cash: qty = risk / stopDist, capped at 4x notional
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 4 / ctx.price);
    ctx.watch([{ side:'buy', note:'Fed cutting', conds:[
      { label:'Fed cutting (30d)', ok: easing }
    ]}]);
    return { side:'buy', qty };
  }
  return null;
}
