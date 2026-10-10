/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 Chandelier 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 200d EMA trend filter was tested and REJECTED — it cut returns on
 * both dev windows (bear +20 vs +24, bull +623 vs +927) without reducing MDD. The real
 * weakness is the exit: the 10-bar channel low is slow, so on the holdout a crash let MDD
 * run to 70%. A chandelier trail from the highest close since entry with 3x ATR locks in
 * gains tighter in a crash while still letting winners run.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells
 * when a closed bar closes below the chandelier stop (highest close since entry minus 3x
 * ATR), or 2x ATR below entry as a floor stop.
 * When it does NOT work: In a long range where every 55d breakout is a trap it still gets
 * chopped. It never shorts, so a multi-year bear is just flat. A violent gap through the
 * floor stop still hurts.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    // track the highest close since entry for the chandelier trail
    const hi = Math.max(ctx.state.hiSinceEntry || entry, prevClose, price);
    ctx.state.hiSinceEntry = hi;
    // chandelier exit: 3x ATR below the highest close since entry. Trails tighter than the
    // 10-bar channel low so a crash is cut sooner (the holdout MDD problem).
    const floor = entry - 2 * atr; // unchanged 2x ATR floor stop
    const exited = prevClose < hi - 3 * atr || price < floor;
    ctx.watch([{ side: 'sell', price: hi - 3 * atr, trigger: 'below', note: 'chandelier' },
               { side: 'sell', price: floor, trigger: 'below', note: '2 ATR floor' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // 55-bar breakout, EXCLUDE the current closed bar so prevClose can exceed it.
  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.state.hiSinceEntry = prevClose;
    ctx.watch([{ side: 'sell', price: price - 3 * atr, trigger: 'below', note: 'chandelier' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
