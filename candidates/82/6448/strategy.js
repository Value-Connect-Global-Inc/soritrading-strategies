/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Cycle 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily unique active addresses measure real network
 * usage, which expands through bull cycles and contracts through bear markets.
 * It is used here as a STICKY ENTRY FILTER only: we only START a long when on-chain
 * usage is clearly expanding AND price is in an uptrend, but we never exit on
 * adoption alone (that toggled daily and caused churn). Exits come only from the
 * price trend and a hard stop. The idea is to avoid buying into a downtrend while
 * adoption is also falling, without being shaken out of a real rally.
 * When it buys: 30-day smoothed active addresses are at least 1% above their level
 * 30 days ago (clear adoption expansion, sticky) and last close is above a rising
 * SMA200.
 * When it sells: last close drops below SMA200, or a flat 12% hard stop (filled
 * intra-bar so a crash cannot gap through it).
 * When it does NOT work: in institutional rallies where price rises while retail
 * on-chain usage stays flat or falls (post-2023), the adoption filter keeps us out
 * and we miss the move. Address data is daily and lags price by design.
 */
function onUpdate(ctx) {
  const addr = ctx.data('main.addr_sma30');
  if (addr == null) { ctx.watch([]); return null; }

  let hist = ctx.state.addrHist || [];
  hist.push(addr);
  if (hist.length > 40) hist = hist.slice(-40);
  ctx.state.addrHist = hist;

  const pos = ctx.position || 0;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }
  if (hist.length < 31) { ctx.watch([]); return null; }

  // sticky adoption filter: once false, stays false until a clear 1% expansion
  // (1% margin avoids daily toggling of the raw comparison)
  let adoptionOk = ctx.state.adoptionOk === true;
  if (addr > hist[hist.length - 31] * 1.01) adoptionOk = true;
  else if (addr < hist[hist.length - 31]) adoptionOk = false;
  ctx.state.adoptionOk = adoptionOk;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);
  if (sma200 == null || sma200Prev == null) { ctx.watch([]); return null; }

  if (pos > 0) {
    const entry = ctx.entryPx;
    const hardStop = entry != null ? entry * 0.88 : null;
    const trendBreak = prevClose < sma200;
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'below SMA200', conds: [{ label: 'close vs SMA200', now: prevClose, op: '<', ref: sma200, closed: true }] },
      { side: 'sell', price: hardStop, trigger: 'below', note: 'hard stop -12%' }
    ]);
    if (trendBreak) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (hardStop != null) {
      return { side: 'sell', qty: pos, type: 'smart', trigger: hardStop, reduceOnly: true };
    }
    return null;
  }

  const trendUp = prevClose > sma200 && sma200 > sma200Prev;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'above SMA200 + adoption expanding', conds: [{ label: 'adoption expanding', ok: adoptionOk, closed: true }] }]);
  if (trendUp && adoptionOk) {
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
