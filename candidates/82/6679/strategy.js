/*
 * @coinsori-strategy v1
 * name: Alt Crash Dodge ETH 1D
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The same crash-dodge rule that worked on BTC — stay long
 * like holding, but step aside into cash when the daily close falls below the
 * 50-day average (~2.5 months). ETH is higher-beta than BTC, so dodging its
 * crashes should matter even more if the idea is real and not BTC-specific.
 * When it buys and sells: buys (re-enters) when the daily close is above the
 * 50-day average; sells (steps aside) when the close falls below it, or a 25%
 * hard stop below entry is hit.
 * When it does NOT work: in a long sideways market the 50-day line flips and
 * the strategy pays fees on round trips; a sudden crash that gaps through the
 * stop still takes a loss.
 */
function onUpdate(ctx) {
  const SMA_N = 50;      // 50 x 1d = ~2.5 months; the trend line separating up from down
  const STOP = 0.25;     // hard stop below entry; ETH 1d swings are wide so this is loose
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
