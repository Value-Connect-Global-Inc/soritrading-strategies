/*
 * @coinsori-strategy v1
 * name: Dollar-Regime BTC Rider 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that historically rises when the US dollar
 * weakens and falls when the dollar strengthens. The dollar index (dxy) is a slow macro
 * signal that changes regime far less often than price, so it filters out most of the
 * choppy noise that whipsaws pure price breakouts.
 * When it buys and sells: Hold BTC only while the dollar is in a downtrend (its 30-day
 * average falling) AND price is above its 200-day average. Move to cash when the dollar
 * turns up or the price trend breaks.
 * When it does NOT work: In regimes where BTC and the dollar move together (crypto-specific
 * manias or crashes that override the macro backdrop) the dollar filter adds no value and
 * can keep you out of strong rallies that happen despite a firm dollar.
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const dxy = ctx.data('dxy');
  if (sma200 == null || dxy == null) return null;

  const s = ctx.state || (ctx.state = {});
  // Keep a short history of the dollar index to measure its 30-day direction.
  s.dxyHist = s.dxyHist || [];
  s.dxyHist.push(dxy);
  if (s.dxyHist.length > 40) s.dxyHist.shift();
  if (s.dxyHist.length < 30) return null;

  // Dollar is weakening if its value ~30 days ago was higher than today.
  const dxyFalling = dxy < s.dxyHist[s.dxyHist.length - 31];
  const uptrend = ctx.price > sma200;

  if (ctx.position === 0) {
    if (!uptrend || !dxyFalling) return null;
    ctx.watch([{ side: 'sell', price: ctx.price * 0.70, trigger: 'below', note: 'stop -30%' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  const entry = ctx.entryPx;
  const stop = entry != null ? entry * 0.70 : null;
  const watch = [];
  if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'stop -30%' });
  watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' });
  ctx.watch(watch);
  if (stop != null && ctx.price <= stop) return { side: 'sell', qty: ctx.position };
  if (!uptrend || !dxyFalling) return { side: 'sell', qty: ctx.position };
  return null;
}
