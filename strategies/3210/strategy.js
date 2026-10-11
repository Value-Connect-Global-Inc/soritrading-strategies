/*
 * @coinsori-strategy v1
 * name: Baseline Champion Reference
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Exact copy of champion #3206 (Multi-Asset Momentum Hysteresis + Fed Filter)
 * used only as a baseline on the same windows as the new variants, so the
 * comparison is apples-to-apples. Original header:
 * Buy when 90d momentum > +20%, price above 200-day, Fed not hiking.
 * Sell when momentum fades below +5% or price breaks the 200-day.
 *
 * 2025-01-15: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const closes = ctx.closes;
  if (closes.length < 91) return null;
  const prevClose = closes[closes.length - 2];
  const base = closes[closes.length - 91];
  if (base == null || base <= 0) return null;
  const roc90 = (prevClose / base - 1) * 100;

  const fedNow = ctx.data('macro_fed_funds');
  const fedLag = ctx.data('fed_lag30');
  const hiking = (fedNow != null && fedLag != null) ? (fedNow > fedLag) : false;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0 && (roc90 < 5 || prevClose < sma200)) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', qty: pos, note: 'SMA200 break' },
      { side: 'sell', price: base * 1.05, trigger: 'below', qty: pos, note: 'Momentum fade' }
    ]);
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && roc90 > 20 && prevClose > sma200 && !hiking) {
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'below', qty: ctx.cash / ctx.price * 0.33, note: 'SMA200 pullback', conds: [
        { label: 'Momentum', now: roc90, op: '>', ref: 20, closed: true },
        { label: 'Fed hiking', ok: !hiking }
      ]},
      { side: 'buy', price: base * 1.20, trigger: 'above', qty: ctx.cash / ctx.price * 0.33, note: 'Momentum entry', conds: [
        { label: 'Momentum', now: roc90, op: '>', ref: 20, closed: true },
        { label: 'Fed hiking', ok: !hiking }
      ]}
    ]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.33 };
  }
  ctx.watch([]);
  return null;
}
