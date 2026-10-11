/*
 * @coinsori-strategy v1
 * name: BNB 1D Momentum + Fed Filter
 * ex: binance
 * syms: BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the 90-day momentum + 200-day average core is the validated
 * champion on BTC/ETH/SOL and just held up on BNB. Adding the Fed not-hiking
 * filter (the champion's proven improvement) targets the 2018/2022 crypto bears,
 * which were both Fed-hiking periods — BNB's worst drawdowns.
 * When it buys and sells: buys when 90-day momentum is above +20%, price is above
 * the 200-day average, AND the Fed is not hiking. Sells when momentum fades below
 * +5% or price breaks the 200-day average.
 * When it does NOT work: in a Fed-easing regime that is still a crypto bear (late
 * 2018) the filter cannot help, and it can lag a raging bull by waiting for the
 * 200-day break. Single-symbol means no diversification across coins.
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
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

  // Hiking = rate now is higher than 30 days ago. Missing Fed data treated as
  // not hiking so the strategy still trades (baseline behaviour).
  const fedNow = ctx.data('macro_fed_funds');
  const fedLag = ctx.data('fed_lag30');
  const hiking = (fedNow != null && fedLag != null) ? (fedNow > fedLag) : false;

  const pos = ctx.position;

  // --- display only: what this symbol is waiting for ---
  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: '200 SMA break', conds: [
        { label: 'ROC90(1)', now: roc90, op: '<', ref: 5, closed: true }
      ]},
      { side: 'sell', price: base * 1.05, trigger: 'below', note: 'momentum <5%', conds: [
        { label: 'close < SMA200', ok: prevClose < sma200 }
      ]}
    ]);
  } else {
    ctx.watch([
      { side: 'buy', price: Math.max(sma200, base * 1.20), trigger: 'above', note: 'entry zone', conds: [
        { label: 'ROC90(1)', now: roc90, op: '>', ref: 20, closed: true },
        { label: 'Fed not hiking', ok: !hiking }
      ]}
    ]);
  }

  if (pos > 0 && (roc90 < 5 || prevClose < sma200)) {
    return { side: 'sell', qty: pos };
  }
  if (pos === 0 && roc90 > 20 && prevClose > sma200 && !hiking) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
