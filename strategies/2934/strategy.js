/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR Macro-Risk Gated
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Mean-reversion buys dips, but ONLY when the macro regime is risk-ON.
 * Crypto dips are safe to buy when the US dollar (DXY) is not strengthening;
 * a rising dollar = risk-off = falling crypto, where buying dips catches knives.
 * This directly attacks the bear-window losses that killed the plain family.
 *
 * Buys: price below lower Bollinger band, above the 200-SMA by a 6% margin
 * (uptrend), RSI oversold, and DXY not rising (risk-on). Sells: back to the
 * mid-band or RSI overbought.
 *
 * Does NOT work: in a sustained risk-off regime (rising DXY) it sits in cash
 * and misses rallies; in a relentless straight-line bull it exits too early.
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const s200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const dxy = ctx.macro('dxy');
  if (s200 == null || bb == null || rsi == null) {
    ctx.watch([]);
    return null;
  }

  // DIAGNOSTIC: reveal the dxy shape and how often the gate blocks
  const st = ctx.state || {};
  st.n = (st.n || 0) + 1;
  if (st.n % 500 === 1) {
    ctx.log('dxyRaw=' + JSON.stringify(dxy) + ' px=' + px.toFixed(2));
  }

  const marginOk = px > s200 * 1.06;
  let riskOn = true;
  let gateBlocked = false;
  if (dxy != null && dxy.value != null) {
    riskOn = dxy.value < (dxy.prev != null ? dxy.prev : dxy.value + 0.5);
    if (!riskOn) gateBlocked = true;
  } else if (dxy == null) {
    // dxy unknown -> block entry (conservative)
    riskOn = false;
    gateBlocked = true;
  }
  st.gateBlocks = (st.gateBlocks || 0) + (gateBlocked ? 1 : 0);
  if (st.n % 500 === 1) {
    ctx.log('gateBlocks so far=' + st.gateBlocks + ' / ' + st.n);
  }

  if (ctx.position === 0) {
    ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower entry', qty: ctx.cash / px * 0.99, conds: [
      { label: 'px > SMA200*1.06', now: px, op: '>', ref: s200 * 1.06, closed: false },
      { label: 'RSI(14) < 35', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'DXY risk-on', ok: riskOn }
    ]}]);
    if (marginOk && riskOn && px < bb.lower && rsi < 35) {
      return { side: 'buy', qty: ctx.cash / px * 0.99 };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid-band exit', qty: ctx.position },
    { side: 'sell', note: 'RSI overbought exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 65, closed: true }], qty: ctx.position }
  ]);
  if (px > bb.mid || rsi > 65) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
