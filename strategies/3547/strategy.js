/*
 * @coinsori-strategy v1
 * name: Funding Squeeze Long BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: When the funding rate is unusually negative, short sellers are crowded and paying longs to stay short — that pressure often releases as a short squeeze. Buying when shorts are crowded AND price has turned back up above its trend line targets that release instead of catching a falling knife.
 * When it buys and sells: Buys when flat AND funding is at least 1 standard deviation below its own recent average (crowded shorts) AND price is above its 100-bar average AND the last closed bar breaks the prior 20-bar high. Takes half off at +4x entry ATR, sells the rest when price falls 2.5 ATR below the highest close since entry, never worse than 2.5 ATR below entry.
 * When it does NOT work: If the exchange does not supply funding data the strategy never trades. In a slow grind-down funding stays negative for a long time but price stays below its trend line, so it stays flat and misses the whole move. It only buys bounces, never bottoms.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);
  const f = ctx.funding;

  // keep a rolling history of the funding rate (8h funding, ~6 samples/day)
  if (f != null) {
    if (!ctx.state.fh) ctx.state.fh = [];
    ctx.state.fh.push(f);
    if (ctx.state.fh.length > 200) ctx.state.fh.shift();
  }

  // ---- exit: same proven ATR trailing stop as the breakout strategy ----
  if (ctx.position > 0) {
    if (atr == null) return null;
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state.hi = hi;
    const entryAtr = ctx.state.entryAtr != null ? ctx.state.entryAtr : atr;
    ctx.state.entryAtr = entryAtr;
    if (ctx.state.tpDone == null && price >= ctx.entryPx + 4 * entryAtr) {
      ctx.state.tpDone = true;
      return { side: 'sell', qty: ctx.position * 0.5 };
    }
    const stopPx = Math.max(hi - 2.5 * atr, ctx.entryPx - 2.5 * entryAtr);
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'ATR trailing stop' }]);
    return null;
  }

  // ---- entry: funding contrarian squeeze ----
  if (f == null) return null;               // no funding data -> never trade
  const fh = ctx.state.fh;
  if (!fh || fh.length < 100) return null;  // need ~17 days of funding history
  let mean = 0; for (const x of fh) mean += x; mean /= fh.length;
  let varr = 0; for (const x of fh) varr += (x - mean) * (x - mean); varr /= fh.length;
  const sd = Math.sqrt(varr);
  if (sd <= 0) return null;
  // z-score: how unusually negative funding is right now vs its own recent history
  const z = (f - mean) / sd;
  if (z > -1.0) return null;                // shorts not crowded enough

  // trend gate: only buy bounces, not falling knives (price above 100-bar average)
  const sma100 = ctx.sma(100, 1);
  if (sma100 == null || price < sma100) return null;

  // squeeze trigger: last closed bar breaks the prior 20-bar high
  const lastHi = ctx.high(1, 1);
  const priorHi = ctx.high(20, 2);
  if (lastHi == null || priorHi == null || lastHi <= priorHi) {
    if (priorHi != null) ctx.watch([{ side: 'buy', price: priorHi, trigger: 'above', note: '20-bar squeeze breakout', conds: [{ label: 'funding z', now: z, op: '<', ref: -1.0, closed: true }, { label: 'price>SMA100', ok: price > sma100 }] }]);
    return null;
  }

  ctx.state.hi = price;
  ctx.state.entryAtr = atr;
  ctx.state.tpDone = null;
  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
