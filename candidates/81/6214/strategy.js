/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC is a global risk asset - when the NASDAQ-100 is above its long-term average risk
 * appetite is healthy and BTC trends up; when NDX is below it, BTC usually slides too. A 2%
 * hysteresis band stops the regime gate from flip-flopping on small NDX wobbles.
 * When it buys/sells: buy when NDX > 1.02 x its 100d avg AND BTC close is above its 200-bar
 * SMA (medium uptrend); sell when NDX < 0.98 x its avg (risk-off) OR BTC closes 15% below its
 * peak since entry (crash stop).
 * When it fails: if BTC decouples from US equities (crypto-only boom or long chop) the NDX
 * gate adds nothing and the 15% stop takes losses one by one.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const inPos = pos > 1e-9;
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  // ---- NDX regime with hysteresis ----
  const ndx = ctx.data("base.ndx");
  if (ndx == null) return null;
  let hist = ctx.state.ndxHist || [];
  if (ctx.state.lastNdx !== ndx) {
    hist.push(ndx);
    if (hist.length > 260) hist = hist.slice(-260);
    ctx.state.ndxHist = hist;
    ctx.state.lastNdx = ndx;
  }
  if (hist.length < 100) return null;
  let sum = 0;
  for (let k = hist.length - 100; k < hist.length; k++) sum += hist[k];
  const ndxMean = sum / 100;

  let regime = ctx.state.regime;
  if (regime !== 'on' && ndx > ndxMean * 1.02) regime = 'on';
  else if (regime === 'on' && ndx < ndxMean * 0.98) regime = 'off';
  ctx.state.regime = regime;
  if (regime == null) return null;      // wait for a clear regime signal
  const riskOn = regime === 'on';

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  if (inPos) {
    let peak = ctx.state.peakClose;
    if (peak == null || close > peak) { peak = close; ctx.state.peakClose = peak; }
    const stop = peak * 0.85;
    if (!riskOn) {
      ctx.watch([{ side: 'sell', price: ndxMean * 0.98, trigger: 'below', note: 'NDX risk-off' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (close < stop) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% crash stop' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% crash stop' }]);
    return null;
  }

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';
  if (riskOn && close > sma200 && allocOk) {
    ctx.state.peakClose = close;
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'BTC above 200SMA',
      conds: [{ label: 'NDX risk-on', ok: riskOn }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'BTC above 200SMA',
    conds: [{ label: 'NDX risk-on', ok: riskOn }] }]);
  return null;
}
