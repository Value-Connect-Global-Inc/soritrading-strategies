/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crowd sentiment extremes (the Fear & Greed index) mark
 * panic bottoms where price tends to revert up. This is the opposite of
 * trend-following, which bleeds in range markets — the recent regime that
 * killed the trend idea. Long only.
 * When it buys and sells: buys when the index is below 30 (fear) AND price is
 * oversold (RSI<30) AND below the lower Bollinger band — a panic bottom. Sells
 * when the index has recovered to greed (>=70), price returns above its 20-SMA
 * (mean reversion complete), or a 2x ATR stop loss hits. Position risk 2% of cash.
 * When it does NOT work: in a persistent bear market the index stays low for
 * months, so it keeps buying falling knives and the stop is hit repeatedly —
 * it never catches knives that keep falling. It also does nothing when fear
 * never materializes, missing all upside in a straight bull.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);          // last closed bar (ago=1)
  const fg = ctx.data('fg');                // Fear & Greed index (daily, forward-filled)
  if (price == null || fg == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 2 * atr;                 // hard loss cap: 2x ATR below entry

  // ---- exits first so a stop can never be missed ----
  if (ctx.position > 0) {
    if (ctx.entryPx == null) return null;
    const stop = ctx.entryPx - stopDist;
    const sma20 = ctx.sma(20, 1);
    ctx.watch([
      { side:'sell', price: stop, trigger:'below', note:'2xATR stop' },
      { side:'sell', price: sma20, trigger:'above', note:'reversion target' }
    ]);
    if (fg >= 70 || price < stop || (sma20 != null && price >= sma20)) {
      return { side:'sell', qty: ctx.position };
    }
    return null;
  }

  // ---- entry: panic + oversold + below the lower band ----
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) return null;
  if (fg < 30 && rsi < 30 && price < bb.lower) {
    // risk 2% of cash: qty = risk / stopDist, capped at 5x notional
    const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 5 / ctx.price);
    ctx.watch([{ side:'buy', note:'panic bottom', conds:[
      { label:'FG index', now: fg, op:'<', ref:30, closed:true },
      { label:'RSI(14) close', now: rsi, op:'<', ref:30, closed:true },
      { label:'close < BB lower', ok: price < bb.lower }
    ]}]);
    return { side:'buy', qty };
  }
  return null;
}
