/*
 * @coinsori-strategy v1
 * name: Long-By-Default Crash Dodge 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Holding Bitcoin earns the full ride up but takes the full
 * ride down too. This strategy stays long most of the time — like holding — so it
 * does not miss the rising market, but it steps aside into cash whenever the daily
 * close falls below its 50-day average (~2.5 months), which historically marks the
 * start of most serious drawdowns. The idea is to keep the upside of holding and
 * cut the worst of the crashes.
 * When it buys and sells: buys (re-enters) when the daily close is above the 50-day
 * average; sells (steps aside) when the close falls below the 50-day average, or a
 * 25% hard stop below entry is hit.
 * When it does NOT work: in a long sideways market the 50-day line flips back and
 * forth and the strategy pays fees on round trips; in a sudden crash that gaps
 * through the stop the hard stop limits but does not remove the loss.
 */
function onUpdate(ctx) {
  const SMA_N = 50;      // 50 x 1d = ~2.5 months; the trend line that separates up from down
  const STOP = 0.25;     // hard stop below entry; 1d swings are wide so this is loose
  const SIZE = 0.98;     // nearly full size — we want to be in the market like holding

  const sma = ctx.sma(SMA_N, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma == null || prevClose == null) { ctx.watch([]); return null; }

  const holding = ctx.position > 1e-9;
  const inUptrend = prevClose > sma;   // close above the 2.5-month trend line

  // rule 6: declare every entry/exit price every tick
  if (holding) {
    const w = [{ side: 'sell', price: sma, trigger: 'below', note: 'trend break' }];
    if (ctx.entryPx != null) {
      w.push({ side: 'sell', price: ctx.entryPx * (1 - STOP), trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(w);
  } else {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'trend up' }]);
  }

  // exits (reduce-only, sized from ctx.position)
  if (holding) {
    if (!inUptrend) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - STOP)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // re-enter when the trend line turns back up
  if (inUptrend) {
    return { side: 'buy', qty: ctx.cash / ctx.price * SIZE };
  }
  return null;
}
