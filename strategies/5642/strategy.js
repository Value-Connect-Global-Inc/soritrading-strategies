/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Timing 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC behaves as a high-beta risk asset, but it can also
 * crash on crypto-specific news while equities stay calm. Requiring BOTH the
 * equity regime (NDX above its SMA200) AND BTC's own trend (BTC above its
 * SMA200) before going long keeps us out of crypto-specific drawdowns that a
 * pure cross-asset filter misses.
 * When it buys and sells: long BTC when NDX>SMA200 AND BTC>SMA200; exit when
 * either breaks below its SMA200, or hard stop at -18%.
 * When it does NOT work: in a crypto-only bull run that equities do not join,
 * NDX stays below its SMA200 and BTC rallies without us.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ndx = ctx.data("base_ndx");
  if (ndx == null) return null; // no NDX data -> do nothing

  const st = ctx.state;
  const buf = st.ndxBuf || [];
  if (buf.length < 200) {
    buf.push(ndx);
    st.ndxBuf = buf;
    return null; // still warming up the NDX buffer
  }
  buf.push(ndx);
  if (buf.length > 200) buf.shift();
  st.ndxBuf = buf;

  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  const ndxSma200 = sum / buf.length;

  const btcSma200 = ctx.sma(200, 1);
  if (btcSma200 == null || !Number.isFinite(btcSma200)) return null;

  const ndxRiskOn = ndx > ndxSma200;
  const btcTrendUp = price > btcSma200;
  const riskOn = ndxRiskOn && btcTrendUp; // both anchors agree

  const pos = ctx.position;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const watches = [
      { side: 'sell', price: price, trigger: 'below', note: 'Regime break exit', conds: [
        { label: 'NDX < SMA200', ok: !ndxRiskOn },
        { label: 'BTC < SMA200', ok: !btcTrendUp }
      ]}
    ];
    if (entry != null && Number.isFinite(entry)) {
      watches.push({ side: 'sell', price: entry * 0.82, trigger: 'below', note: 'Hard stop -18%' });
    }
    ctx.watch(watches);

    if (!riskOn && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entry != null && Number.isFinite(entry) && price < entry * 0.82) {
      ctx.state.cd = 10;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'Risk-on entry', conds: [
      { label: 'NDX > SMA200', ok: ndxRiskOn },
      { label: 'BTC > SMA200', ok: btcTrendUp }
    ]}
  ]);

  if (riskOn && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    const atr = ctx.atr(14, 1);
    let frac = 0.95;
    if (atr != null && atr > 0) {
      const dailyVol = atr / price;
      frac = 0.02 / dailyVol;
      frac = Math.max(0.2, Math.min(0.95, frac));
    }
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * frac };
  }
  return null;
}
