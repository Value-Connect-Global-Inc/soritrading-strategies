/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Trend Strength-Sized 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 * marketType: usdm
 *
 * Why this strategy: BTC alternates between long trending regimes. Going SHORT in
 * downtrends turns crashes into profit instead of just avoiding them. Trend regime
 * is read from SMA200 slope + close. Position size scales with trend STRENGTH
 * (distance of price from SMA200, in ATR units): weak/flat trends get small size so
 * whipsaws cost little; strong trends get full size to capture the move.
 * When it buys (long): last close above SMA200 and SMA200 rising.
 * When it sells short: last close below SMA200 and SMA200 falling.
 * When it exits: the opposite trend signal flips, or a 2.5xATR stop below/above
 * entry caps the loss on every position. Notional exposure is capped at 60%.
 * When it does NOT work: in choppy sideways markets SMA200 flips repeatedly and both
 * directions get whipsawed; fees and stops eat the edge. ATR stops can be wide in
 * high-volatility regimes, so single-position losses are real.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);
  if (sma200 == null || sma200Prev == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }
  const atr14 = ctx.atr(14, 1);

  const pos = ctx.position || 0;
  const price = ctx.price;
  const trendUp = prevClose > sma200 && sma200 > sma200Prev;
  const trendDown = prevClose < sma200 && sma200 < sma200Prev;

  const st = ctx.state;
  if (st.ready == null) {
    st.ready = true;
    st.suppressUntil = ctx.i + 15;
  }
  const lf = ctx.alloc ? ctx.alloc.lastForced : null;
  if (lf != null && st.lastForced !== lf) {
    st.lastForced = lf;
    st.suppressUntil = Math.max(st.suppressUntil || 0, ctx.i + 15);
  }
  if (pos === 0 && st.prevPos !== 0) {
    st.suppressUntil = Math.max(st.suppressUntil || 0, ctx.i + 15);
  }
  st.prevPos = pos;
  const demoted = ctx.alloc && ctx.alloc.status !== 'ok';
  const suppressed = ctx.i < (st.suppressUntil || 0);

  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry == null) { ctx.watch([]); return null; }
    const stop = atr14 != null ? entry - 2.5 * atr14 : null;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend down flip', conds: [{ label: 'close vs SMA200', now: prevClose, op: '<', ref: sma200, closed: true }] },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }
    ]);
    if (trendDown || (stop != null && prevClose < stop)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    const entry = ctx.entryPx;
    if (entry == null) { ctx.watch([]); return null; }
    const stop = atr14 != null ? entry + 2.5 * atr14 : null;
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'trend up flip', conds: [{ label: 'close vs SMA200', now: prevClose, op: '>', ref: sma200, closed: true }] },
      { side: 'buy', price: stop, trigger: 'above', note: 'ATR stop' }
    ]);
    if (trendUp || (stop != null && prevClose > stop)) {
      return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'long trend up', conds: [{ label: 'SMA200 rising', ok: trendUp, closed: true }] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'short trend down', conds: [{ label: 'SMA200 falling', ok: trendDown, closed: true }] }
  ]);
  if (suppressed || demoted) return null;
  const lastEntryBar = st.lastEntryBar != null ? st.lastEntryBar : -1;
  if (trendUp) {
    if (lastEntryBar === ctx.i) return null;
    const strength = atr14 != null && atr14 > 0 ? (prevClose - sma200) / atr14 : 1;
    const frac = Math.min(0.6, Math.max(0.1, 0.15 * strength));
    const qty = (ctx.cash / price) * frac;
    if (qty <= 0) return null;
    st.lastEntryBar = ctx.i;
    return { side: 'buy', qty: qty };
  }
  if (trendDown) {
    if (lastEntryBar === ctx.i) return null;
    const strength = atr14 != null && atr14 > 0 ? (sma200 - prevClose) / atr14 : 1;
    const frac = Math.min(0.6, Math.max(0.1, 0.15 * strength));
    const qty = (ctx.cash / price) * frac;
    if (qty <= 0) return null;
    st.lastEntryBar = ctx.i;
    return { side: 'sell', qty: qty };
  }
  return null;
}
