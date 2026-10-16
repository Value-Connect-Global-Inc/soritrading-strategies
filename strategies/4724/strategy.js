/*
 * @coinsori-strategy v1
 * name: MeanRevDaily1d
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: on a daily timeframe Bitcoin still mean-reverts — sharp
 * oversold dips back to the middle of its Bollinger band. The 4h version of
 * this idea whipsawed, but on 1d the same signal is cleaner and was validated
 * in earlier cycles as part of a regime blend. Long only.
 * When it buys and sells: buys when RSI(14) < 30 AND close is below the lower
 * Bollinger band (20,2) — a panic dip. Sells when price returns to the band
 * middle, or a 2x ATR stop loss hits. Risk 2% of cash per trade.
 * When it does NOT work: in a persistent bear market (e.g. 2022) every dip it
 * buys keeps falling and the stop is hit repeatedly — it never catches a knife
 * that keeps going down. It also does nothing in a straight bull with no dips.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed daily bar
  if (price == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 2 * atr;                 // hard loss cap: 2x ATR below entry

  // ---- exits first so a stop can never be missed ----
  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx - stopDist;
    const bb = ctx.bb(20, 2, 1);
    const mid = bb == null ? null : bb.mid;
    ctx.watch([
      { side:'sell', price: stop, trigger:'below', note:'2xATR stop' },
      { side:'sell', price: mid, trigger:'above', note:'mean target' }
    ]);
    if (price < stop || (mid != null && price >= mid)) return { side:'sell', qty: ctx.position };
    return null;
  }

  // ---- entry: oversold dip below the lower band ----
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) return null;
  if (rsi < 30 && price < bb.lower) {
    // risk 2% of cash: qty = risk / stopDist, capped at 5x notional
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 5 / ctx.price);
    ctx.watch([{ side:'buy', note:'oversold dip', conds:[
      { label:'RSI(14) close', now: rsi, op:'<', ref:30, closed:true },
      { label:'close < BB lower', ok: price < bb.lower }
    ]}]);
    return { side:'buy', qty };
  }
  return null;
}
