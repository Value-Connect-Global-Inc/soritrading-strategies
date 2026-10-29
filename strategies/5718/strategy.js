/*
 * @coinsori-strategy v1
 * name: BTC SMA200 Trend + On-chain Confirm 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 200-day trend strategy (5714) is this job's best, but
 * it buys any uptrend regardless of whether it is backed by real network usage.
 * A price rally not confirmed by growing active addresses is weaker and more
 * prone to reversal. This version adds an on-chain confirmation filter: it only
 * enters the 200-day uptrend when network adoption is also expanding, and exits
 * early if adoption contracts even while price is still above the 200-day line.
 * When it buys and sells: Buys when the previous close is above the 200-day
 * average AND the 30-day average of active addresses is rising. Sells when the
 * close falls below the 200-day average OR the 30-day address average stops
 * rising. No other exits.
 * When it does NOT work: In a bear market it stays in cash (safe but misses
 * relief rallies). If the on-chain dataset is unavailable it never trades.
 * Address data can lag price by weeks, so exits may be late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // on-chain: 30-day average of active addresses, rolled in ctx.state
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
  const addrUp = addrNow > hist[hist.length - 31];

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'close>200d + addr rising',
      conds: [
        { label: 'addr_sma30 rising', ok: addrUp },
        { label: 'close > SMA200', ok: prevClose > sma200 }
      ] },
    { side: 'sell', price: sma200, trigger: 'below', note: 'close<200d or addr flat',
      conds: [{ label: 'addr_sma30 rising', ok: addrUp }] }
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
