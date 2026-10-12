/*
 * @coinsori-strategy v1
 * name: Keltner MR generalization ADA/DOT/XRP
 * ex: binance
 * syms: ADAUSDT, DOTUSDT, XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe was validated
 * positive 11/11 windows on ETH/BTC/SOL 4h but failed on XLM. This maps the
 * family's asset coverage by running the SAME recipe on ADA, DOT, XRP.
 * When it buys and sells: buys a flush to the lower Keltner band (EMA20 - 2.5x
 * ATR) with RSI<40 while price is above the 200-bar average; sells on the
 * snap-back to the middle band (EMA20). A 2-bar cooldown prevents re-buying.
 * When it does NOT work: in a persistent downtrend below the 200-bar average it
 * stays idle, and it lags straight-line melt-ups (no deep flushes to catch).
 */
// 2025-04-10 표시만 바뀜, 매매 판단은 그대로
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const lower = ema20 - 2.5 * atr;
  const st = ctx.state;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 exit' }
    ]);
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const cooldownOver = st.cooldown == null || ctx.i >= st.cooldown;
  ctx.watch([
    {
      side: 'buy',
      price: lower,
      trigger: 'below',
      qty: ctx.cash / price * 0.9,
      note: 'Keltner lower',
      conds: [
        { label: 'price > SMA200', ok: price > sma200 },
        { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'cooldown over', ok: cooldownOver }
      ]
    }
  ]);

  if (st.cooldown != null && ctx.i < st.cooldown) return null;

  if (price > sma200 && price <= lower && rsi < 40) {
    st.cooldown = null;
    return { side: 'buy', qty: ctx.cash / price * 0.9 };
  }
  return null;
}
