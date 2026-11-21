/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a high-beta risk asset: it rallies when
 * global risk appetite is strong and crashes when risk is off. The NASDAQ-100
 * index (base_ndx) is a clean, independent measure of global risk appetite. We
 * stay long BTC only while BOTH the equity market (NDX above its 200-day average)
 * and BTC itself (above its 200-day average) are in uptrends, and step aside when
 * either turns down. This keeps us in institutional-led bull rallies that pure
 * crypto-sentiment signals miss, and out of broad risk-off crashes.
 * When it buys: NDX close above its 200-day average (risk-on) and BTC close above
 * its SMA200 (own uptrend), and we are flat.
 * When it sells: BTC close drops below its SMA200, NDX drops below its 200-day
 * average (risk-off), or a flat 15% hard stop (filled intra-bar so a crash cannot
 * gap through it).
 * When it does NOT work: in crypto-specific rallies that equities do not join
 * (NDX flat/falling while BTC rises), the NDX gate keeps us out and we miss the
 * move. NDX is business-days only and lags by 2 days, so weekend crypto moves are
 * invisible until Monday.
 */
function onUpdate(ctx) {
  const ndx = ctx.data('base_ndx');
  if (ndx == null) { ctx.watch([]); return null; }

  // accumulate NDX history and compute its 200-day average manually
  let ndxHist = ctx.state.ndxHist || [];
  ndxHist.push(ndx);
  if (ndxHist.length > 201) ndxHist = ndxHist.slice(-201);
  ctx.state.ndxHist = ndxHist;
  if (ndxHist.length < 200) { ctx.watch([]); return null; }
  const ndxSma = ndxHist.reduce((a, b) => a + b, 0) / ndxHist.length;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const btcSma = ctx.sma(200, 1);
  if (btcSma == null) { ctx.watch([]); return null; }

  const ndxRiskOn = ndx > ndxSma;
  const btcTrendUp = prevClose > btcSma;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const hardStop = entry != null ? entry * 0.85 : null;
    ctx.watch([
      { side: 'sell', price: btcSma, trigger: 'below', note: 'BTC below SMA200', conds: [{ label: 'BTC close vs SMA200', now: prevClose, op: '<', ref: btcSma, closed: true }] },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'NDX risk-off', conds: [{ label: 'NDX below 200d avg', ok: !ndxRiskOn, closed: true }] },
      { side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop -15%' }
    ]);
    if (!btcTrendUp || !ndxRiskOn) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (hardStop != null) {
      return { side: 'sell', qty: pos, type: 'smart', trigger: hardStop, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: btcSma, trigger: 'above', note: 'BTC above SMA200 + NDX risk-on', conds: [{ label: 'NDX risk-on', ok: ndxRiskOn, closed: true }] }]);
  if (btcTrendUp && ndxRiskOn) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
