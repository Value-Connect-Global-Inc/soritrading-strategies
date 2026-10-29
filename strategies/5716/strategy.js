/*
 * @coinsori-strategy v1
 * name: BTC On-chain Address Momentum 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price is ultimately driven by network usage.
 * When the number of daily active addresses is growing, more people are
 * actually using the network — historically a sign of a healthy bull market.
 * This strategy trades that fundamental signal: it buys when network adoption
 * is expanding and the long-term price trend is up, and sells when adoption
 * contracts or the trend breaks. This is a different axis than pure price
 * trend or crowd sentiment — it uses on-chain usage data from the connected
 * dataset.
 * When it buys and sells: Buys when the 30-day average of active addresses is
 * rising (higher than 30 days ago) AND the previous close is above the 200-day
 * average. Sells when the 30-day address average is falling or the close drops
 * below the 200-day average. No other exits.
 * When it does NOT work: In a bear market active addresses fall and the
 * strategy stays in cash (safe but it misses relief rallies). If the on-chain
 * dataset is unavailable the strategy never trades. Address data is noisy and
 * can lag the price by weeks, so entries can be late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // on-chain: 30-day average of active addresses. ctx.data(key) only has the
  // current bar, so roll a 30-bar history in ctx.state on bar change.
  const addrNow = ctx.data('addr_sma30');
  if (addrNow == null) return null;
  const s = ctx.state;
  if (s.lastBarI !== ctx.i) {
    s.hist = s.hist || [];
    s.hist.push(addrNow);
    if (s.hist.length > 31) s.hist.shift();
    s.lastBarI = ctx.i;
  }
  const hist = s.hist;
  if (hist.length < 31) return null;
  const addrPrev = hist[hist.length - 31];
  const addrUp = addrNow > addrPrev;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'addr growing + close>200d',
      conds: [
        { label: 'addr_sma30 rising', ok: addrUp },
        { label: 'close > SMA200', ok: prevClose > sma200 }
      ] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close<200d or addr falling',
      conds: [{ label: 'addr_sma30 falling', ok: !addrUp }] }
  ]);

  if (pos > 0) {
    if (prevClose < sma200 || !addrUp) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (addrUp && prevClose > sma200) {
    const qty = 0.99 * ctx.cash / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
