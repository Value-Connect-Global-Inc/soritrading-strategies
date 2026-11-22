/*
 * @coinsori-strategy v1
 * name: VIX z-score regime filter BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin crashes usually arrive together with an extreme spike in fear, measured by the VIX
 * index, while sustained rallies happen even when the VIX is merely elevated. So the VIX is used as a crash
 * override on top of a plain trend filter: hold BTC while the medium-term trend is up, and step aside when the
 * trend turns down OR when fear spikes to an extreme.
 * When it buys and sells: I hold BTC while price is above the 50-day trend line (SMA300 on 4h). I sell when price
 * falls below it, or when the VIX z-score jumps above +2 (a genuine panic), or on a -15% hard stop. I only open a
 * new long when price is above the trend line and the VIX is not elevated (z below +1).
 * When it does NOT work: in a choppy sideways market the trend line whipsaws and each crossing costs fees; and
 * during a fast crash the 2-day lag on the VIX data means the hard stop, not the VIX, is what actually limits loss.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const inPos = ctx.position > 0;
  const sma = ctx.sma(300, 1); // ~50-day trend line from the last CLOSED 4h bar

  // VIX is a daily macro value; on 4h bars it changes roughly once per day.
  const vix = ctx.data('base_vix');

  // Rolling history of UNIQUE daily VIX readings in ctx.state (restart-safe).
  let z = null;
  if (vix != null) {
    const hist = ctx.state.vixHist || [];
    if (hist.length === 0 || hist[hist.length - 1] !== vix) {
      hist.push(vix);
      if (hist.length > 300) hist.shift(); // ~1 year of daily readings is enough for the norm
      ctx.state.vixHist = hist;
    }
    if (hist.length >= 90) { // need ~3 months of daily VIX before the z-score is meaningful
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / hist.length);
      if (sd > 1e-9) z = (vix - mean) / sd;
    }
  }

  // The VIX signal can only change when the daily reading refreshes (~once per UTC day).
  const t = ctx.candle.time;
  const sec = t > 1e11 ? Math.floor(t / 1000) : t; // handle ms vs s timestamps
  const nextDay = Math.floor(sec / 86400 + 1) * 86400;

  const trendUp = sma != null && price > sma;
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.85 : null; // -15% hard stop backstop

  // Declare what we are waiting for (required every tick).
  if (sma == null || z == null) {
    ctx.watch([]); // still warming up indicators / VIX history
  } else if (!inPos) {
    ctx.watch([{
      side: 'buy',
      price: sma,
      trigger: 'above',
      note: 'price above SMA300',
      conds: [{ label: 'VIX z-score', now: z, op: '<', ref: 1, closed: true }]
    }]);
  } else {
    const w = [
      { side: 'sell', price: sma, trigger: 'below', note: 'price below SMA300' },
      {
        side: 'sell',
        at: nextDay,
        note: 'next daily VIX reading',
        conds: [{ label: 'VIX z-score', now: z, op: '>', ref: 2, closed: true }]
      }
    ];
    if (stopPx != null) w.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop -15%' });
    ctx.watch(w);
  }

  // Exits: trend broken, extreme fear spike, or hard stop.
  if (inPos && sma != null && price < sma) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (inPos && z != null && z > 2) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (inPos && stopPx != null && price <= stopPx) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }

  // Entry: uptrend and VIX not elevated.
  if (!inPos && sma != null && z != null && trendUp && z < 1) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }

  return null;
}
