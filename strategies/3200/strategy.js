/*
 * @coinsori-strategy v1
 * name: SOL 1D Momentum Hysteresis
 * ex: binance
 * syms: SOLUSDT
 * interval: 1d
 * cash: 10000
 * 수정일: 2026-04-26, 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: the validated BTC 1D long-horizon momentum hysteresis mechanism
 * applied to SOL to test whether the edge generalizes to another large-cap crypto.
 * Same idea: multi-month trends, 90-day ROC entry with 200-day trend filter and a
 * separate lower exit threshold (hysteresis) to avoid whipsaw.
 * When it buys and sells: Buy when 90-day price change above +20% AND price above its
 * 200-day average. Sell when 90-day change falls below +5% or price drops below the
 * 200-day average.
 * When it does NOT work: in long sideways/choppy markets the slow signals whipsaw;
 * in fast V-reversals the 200-day gate exits late. SOL is more volatile than BTC so
 * drawdowns are larger. No profit promised.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) {
    ctx.watch([]);
    return null;
  }
  const closes = ctx.closes;
  if (closes.length < 91) {
    ctx.watch([]);
    return null;
  }
  const prevClose = closes[closes.length - 2];
  const base = closes[closes.length - 91];
  if (base == null || base <= 0) {
    ctx.watch([]);
    return null;
  }
  const roc90 = (prevClose / base - 1) * 100;

  if (ctx.position > 0) {
    const exitRocPrice = base * 1.05;
    ctx.watch([
      { side: 'sell', price: exitRocPrice, trigger: 'below', note: '90d ROC < 5%' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'close < SMA200' }
    ]);
    if (roc90 < 5 || prevClose < sma200) {
      return { side: 'sell', qty: ctx.position };
    }
  } else {
    const entryRocPrice = base * 1.20;
    ctx.watch([
      {
        side: 'buy',
        price: entryRocPrice,
        trigger: 'above',
        note: '90d ROC > 20%',
        conds: [{ label: 'close > SMA200', now: prevClose, op: '>', ref: sma200, closed: true }]
      }
    ]);
    if (roc90 > 20 && prevClose > sma200) {
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
  }
  return null;
}
