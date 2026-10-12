// 2026-05-08 표시만 바뀜, 매매 판단은 그대로
/*
 * @coinsori-strategy v1
 * name: Fed Tightening-Onset Regime BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a high-beta risk asset that historically
 * struggles during Fed tightening cycles (rising policy rates drain
 * liquidity) and thrives when the Fed is on hold or easing. This bets on
 * the monetary-policy regime: stay long while the Fed is not hiking, step
 * aside when a tightening cycle begins. It uses the fed funds rate compared
 * to its level 30 days ago to detect the onset of a hike quickly.
 * When it buys and sells: stays long while the current fed funds rate is
 * not above its level 30 days ago (no tightening); sells when the rate has
 * risen over the last 30 days (hiking has begun).
 * When it does NOT work: crypto can rally hard even while the Fed hikes
 * (e.g. liquidity-driven melt-ups), so this can sit out strong bulls. And
 * the 30-day comparison can be slow to flip back after a hike ends. It is a
 * slow, macro-frequency signal with genuinely high drawdowns when it is long
 * during a non-hiking bear.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Fed funds rate now, and its level 30 days ago (both external datasets).
  const now = Number(ctx.data('fed'));
  const lag = Number(ctx.data('fed_lag30'));
  if (!Number.isFinite(now) || now <= 0) return null;
  if (!Number.isFinite(lag) || lag <= 0) return null;

  // Hiking if the current rate is above the 30-day-ago level by a small
  // buffer (0.25pp = one typical hike) to avoid churn on tiny moves.
  const hiking = now > lag + 0.25;

  // Display-only: what this symbol is waiting for right now.
  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      qty: pos,
      note: 'Fed hike onset (rate > 30d ago + 0.25)',
      conds: [{ label: 'Fed funds now', now: now, op: '>', ref: lag + 0.25 }]
    }]);
  } else {
    ctx.watch([{
      side: 'buy',
      qty: ctx.cash / price * 0.95,
      note: 'Fed not hiking (rate <= 30d ago + 0.25)',
      conds: [{ label: 'Fed funds now', now: now, op: '<=', ref: lag + 0.25 }]
    }]);
  }

  // --- Exit: a tightening cycle has begun ---
  if (pos > 0) {
    if (hiking) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: not hiking ---
  if (!hiking) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
