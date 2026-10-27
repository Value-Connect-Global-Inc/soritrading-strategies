/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Timing 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC behaves as a high-beta risk asset — when equity risk
 * appetite (NASDAQ-100) is rising, BTC tends to rally harder; when equities
 * break down, BTC falls faster. Timing BTC long/flat on NDX's own 200-day
 * trend captures uptrends while stepping aside in risk-off regimes, using a
 * signal entirely external to BTC's price.
 * When it buys and sells: long BTC while NDX is above its SMA200; exit when
 * NDX closes below SMA200, or hard stop at -18%.
 * When it does NOT work: in a crypto-specific bull run equities do not join,
 * NDX stays below its SMA200 and BTC goes up without us.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ndx = ctx.data("base_ndx");
  if (ndx == null) return null; // no NDX data -> do nothing

  // keep a rolling buffer of NDX values in state to compute a true SMA200
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

  const riskOn = ndx > ndxSma200; // NDX above its 200-day average -> equity uptrend

  const pos = ctx.position;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const watches = [
      { side: 'sell', price: price, trigger: 'below', note: 'NDX SMA200 break', conds: [{ label: 'NDX < SMA200', ok: !riskOn }] }
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
    { side: 'buy', price: price, trigger: 'above', note: 'NDX risk-on entry', conds: [{ label: 'NDX > SMA200', ok: riskOn }] }
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
