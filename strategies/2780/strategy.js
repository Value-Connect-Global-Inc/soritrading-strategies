/*
 * @coinsori-strategy v1
 * name: Volume-Panic Mean Reversion BTC 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A contrarian family — instead of following trends (like OBV
 * volume-flow), it fades panic. Sharp, volume-backed price drops in crypto are
 * often overreactions (liquidations, fear), and price tends to snap back after
 * the panic exhausts. Hypothesis: buying extreme oversold + heavy volume +
 * sharp drop captures the mean-reversion bounce.
 * When it buys and sells: buys when RSI(3) is very oversold (<25) AND price
 * dropped sharply (~4% over 3 bars) AND volume is above its 30-bar average
 * (real panic, not quiet drift). Sells when RSI recovers (>55) or after a small
 * profit (~8%) or after 10 bars (time stop) to avoid holding a falling knife.
 * When it does NOT work: in a true bear-market crash, the "bounce" never comes
 * and the strategy catches falling knives — the time stop and 8% target limit
 * losses but repeated entries bleed. Also whipsaws in deep chop where every
 * drop is followed by another drop.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const rsi3 = ctx.rsi(3, 1);
  const closes = ctx.closes;
  if (rsi3 == null || !closes || closes.length < 5) {
    ctx.watch([]);
    return null;
  }

  // 3-bar drop computed directly from closes (unit-independent).
  const cNow = closes[closes.length - 1];
  const c3ago = closes[closes.length - 4];
  const dropPct = (cNow / c3ago - 1) * 100;

  const avgV = ctx.avgVol(30);
  const vol = ctx.vol;
  const volOk = avgV != null && Number.isFinite(avgV) && avgV > 0 &&
                Number.isFinite(vol) && vol > avgV * 1.3;

  const st = ctx.state;
  if (pos > 0) {
    // Exit: RSI recovered, small profit target, or 10-bar time stop.
    const barsHeld = (st.barsHeld || 0) + 1;
    st.barsHeld = barsHeld;
    const entry = st.entry || price;
    const pnlPct = (price / entry - 1) * 100;

    ctx.watch([
      { side: 'sell', qty: pos, note: 'RSI recovered', conds: [{ label: 'RSI(3) close', now: rsi3, op: '>', ref: 55, closed: true }] },
      { side: 'sell', qty: pos, note: 'profit target', conds: [{ label: 'PnL %', now: pnlPct, op: '>=', ref: 8 }] },
      { side: 'sell', qty: pos, note: 'time stop', conds: [{ label: 'bars held', now: barsHeld, op: '>=', ref: 10 }] }
    ]);

    if (rsi3 > 55 || pnlPct >= 8 || barsHeld >= 10) {
      delete st.barsHeld;
      delete st.entry;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Entry: oversold + sharp drop + panic volume.
  ctx.watch([
    { side: 'buy', qty: ctx.cash / price * 0.95, note: 'panic oversold entry', conds: [
      { label: 'RSI(3) close', now: rsi3, op: '<', ref: 25, closed: true },
      { label: '3-bar drop %', now: dropPct, op: '<=', ref: -4 },
      { label: 'vol > 1.3×avg30', ok: volOk }
    ] }
  ]);

  if (rsi3 < 25 && dropPct <= -4 && volOk) {
    st.entry = price;
    st.barsHeld = 0;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
