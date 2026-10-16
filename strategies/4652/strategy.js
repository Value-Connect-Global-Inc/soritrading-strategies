/*
 * @coinsori-strategy v1
 * name: XRP Donchian Turtle ATR-Trail 4H
 * ex: binance
 * syms: XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The 55/20-bar Donchian turtle rides XRP's sustained moves,
 * but a FIXED 15% stop is too wide in crashes and too tight in low-vol chop —
 * it gives back profits on both bull windows. Replacing it with a chandelier
 * trailing stop (2.5x ATR, ratcheted up with each new high) makes the exit
 * adapt to current volatility, so winners are kept longer and breakdowns cut
 * earlier. The 20-bar low breakdown exit is kept as a second, slower exit —
 * whichever triggers first. Entry stays the proven 55-bar-high breakout with a
 * rising 200-SMA filter.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars AND the 200-SMA is rising. Sell when price
 * falls below the 2.5x-ATR trailing stop, or a closed bar breaks the 20-bar low.
 * When it does NOT work: it whipsaws in a sideways range above a flat 200-SMA
 * and lags the very start of a fresh bull from a falling 200-SMA. A tight
 * ATR stop can exit early on a healthy pullback inside a strong trend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);

  // Donchian levels from CLOSED bars, EXCLUDING the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const st = ctx.state;
    if (atr != null && atr > 0) {
      // chandelier: 2.5x ATR is the classic turtle risk width, adapts to vol
      const mult = 2.5;
      if (st.highest == null) st.highest = Math.max(prevClose, ctx.entryPx || prevClose);
      st.highest = Math.max(st.highest, prevClose);
      const newStop = st.highest - mult * atr;
      st.trailStop = (st.trailStop == null) ? newStop : Math.max(st.trailStop, newStop);
      if (price <= st.trailStop) {
        st.highest = null; st.trailStop = null;
        return { side: 'sell', qty: pos };
      }
      if (prevClose < l20) {   // 20-bar low breakdown exit KEPT
        st.highest = null; st.trailStop = null;
        return { side: 'sell', qty: pos };
      }
      ctx.watch([{ side: 'sell', price: st.trailStop, trigger: 'below', note: 'ATR trailing stop' },
                 { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
      return null;
    }
    // ATR unknown: fall back to fixed 15% stop + 20-bar low
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.85 : null;
    if (stop != null && price <= stop) { st.highest = null; st.trailStop = null; return { side: 'sell', qty: pos }; }
    if (prevClose < l20) { st.highest = null; st.trailStop = null; return { side: 'sell', qty: pos }; }
    return null;
  }

  // flat: clear trail state
  if (ctx.state.highest != null) { ctx.state.highest = null; ctx.state.trailStop = null; }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;                       // breakout
  if (!(sma200 > sma200Prev)) return null;                   // 200-SMA must be RISING

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // 4h noise: target 1.5% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
