/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto prices are driven by crowd emotion. When the Fear &
 * Greed index reaches extreme fear, most sellers have already sold and prices are
 * often near a local bottom; when it reaches extreme greed, the crowd is fully
 * long and prices are stretched. We buy the fear inside an uptrend and sell into
 * the greed.
 * When it buys and sells: buys when sentiment is very fearful (index <= 30) and
 * the daily close is above its 200-day average; sells when sentiment turns greedy
 * (index >= 70), when the close falls below the 200-day average, or a 25% hard
 * stop is hit.
 * When it does NOT work: in a long bear market the 200-day filter keeps it in cash
 * (no loss, but no gain while holding makes money on the rebound); in a slow
 * grind higher without fear spikes it enters rarely and can lag buy-and-hold.
 */
function onUpdate(ctx) {
  const SMA_N = 200;       // long-term trend line: 200 x 1d = ~8 months, filters out noise
  const FEAR = 30;         // buy when sentiment is this fearful (contrarian entry)
  const GREED = 70;        // sell when sentiment is this greedy (contrarian exit)
  const STOP = 0.25;       // hard stop below entry; 1d swings are wide so this is loose
  const SIZE = 0.95;

  const sma = ctx.sma(SMA_N, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma == null || prevClose == null) { ctx.watch([]); return null; }

  // sentiment index, used with a one-day lag (yesterday's value) to avoid look-ahead
  const fgNow = ctx.data('fear_greed');
  let fgPrev = (ctx.state && typeof ctx.state.fgPrev === 'number') ? ctx.state.fgPrev : null;
  if (fgNow != null) ctx.state.fgPrev = fgNow;
  if (fgPrev == null) { ctx.watch([]); return null; }

  const holding = ctx.position > 1e-9;
  const trendUp = prevClose > sma;   // long-term uptrend intact
  const fearful = fgPrev <= FEAR;    // crowd is panicking
  const greedy = fgPrev >= GREED;    // crowd is euphoric

  // rule 6: declare every entry/exit price every tick
  if (holding) {
    const w = [
      { side: 'sell', price: sma, trigger: 'below', note: 'trend break' },
      { side: 'sell', price: sma, trigger: 'below', note: 'greed exit', conds: [{ label: 'F&G>=70', ok: greedy }] }
    ];
    if (ctx.entryPx != null) {
      w.push({ side: 'sell', price: ctx.entryPx * (1 - STOP), trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(w);
  } else {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'uptrend', conds: [{ label: 'F&G<=30', ok: fearful }] }]);
  }

  // exits (reduce-only, sized from ctx.position)
  if (holding) {
    if (!trendUp || greedy) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - STOP)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // entry: buy the panic, but only inside a long-term uptrend
  if (trendUp && fearful) {
    return { side: 'buy', qty: ctx.cash / ctx.price * SIZE };
  }
  return null;
}
