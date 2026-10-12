/*
 * @coinsori-strategy v1
 * name: BTC 1D Fed-Gate + Trend Defense (two-state)
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-11 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The pure fed-funds gate holds Bitcoin while the central
 * bank is not actively hiking, but it rides full drawdowns whenever the Fed
 * is on hold (e.g. 2019, 2025 bears). This version keeps the monetary-policy
 * gate AND adds a slow trend defense: it fully exits to cash when price is
 * below its 200-day average even if the Fed is not hiking. It is deliberately
 * TWO-STATE (all in or all out) with no fractional rebalancing, so it does not
 * churn on fees like earlier position-scaling variants.
 * When it buys and sells: it is fully in Bitcoin only when the fed funds rate
 * is not aggressively rising AND price is above its 200-day average. It sells
 * to cash when either condition fails (hiking, or price below the 200-day).
 * It re-enters only when both conditions are met again.
 * When it does NOT work: a sharp V-shaped recovery where price is still below
 * the 200-day at the bottom means it misses the first leg up (the 200-day lags
 * in fast rebounds). And it still has no intra-trend stop, so a slow bleed
 * above the 200-day still draws down.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const fedNow = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  if (fedNow == null || fedLag == null) {
    ctx.watch([]);
    return null;
  }

  // Tightening = current rate meaningfully above its level ~30 rows ago.
  const tightening = fedNow > fedLag + 0.5;

  const sma200 = ctx.sma(200, 1);
  // Trend defense: below the 200-day = bear regardless of policy.
  // 200-day is slow, so this flips rarely (no churn).
  const bearTrend = (sma200 != null && price < sma200);

  const pos = ctx.position;

  // Declare what we are waiting for (display only)
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', note: 'trend exit', conds: [{ label: 'price < SMA200', ok: bearTrend }] },
      { side: 'sell', note: 'policy exit', conds: [{ label: 'Fed hiking', ok: tightening }] }
    ]);
  } else {
    ctx.watch([
      { side: 'buy', note: 'entry', conds: [{ label: 'Fed not hiking', ok: !tightening }, { label: 'price >= SMA200', ok: !bearTrend }] }
    ]);
  }

  if (pos > 0 && (tightening || bearTrend)) {
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && !tightening && !bearTrend) {
    return { side: 'buy', qty: ctx.cash / price * 0.98 };
  }
  return null;
}
