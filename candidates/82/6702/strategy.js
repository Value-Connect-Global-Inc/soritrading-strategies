/*
 * @coinsori-strategy v1
 * name: ETH Book Imbalance 1m
 * ex: binance
 * syms: ETH/USDT
 * interval: 1m
 * cash: 1000
 *
 * Why this strategy: on a liquid pair, when the order book shows much more resting size on the bid than the ask near the mid, price often gets pushed up as that bid side is worked. This tries to ride those short micro-moves.
 * When it buys and sells: it buys when bid-side depth clearly exceeds ask-side depth near the mid, and sells when the imbalance flips against it or a hard stop is hit.
 * When it does NOT work: in thin or gappy books the imbalance is noise; backtests use a synthesized book so only the live paper run sees the real order book.
 */
function onUpdate(ctx) {
  const bid = ctx.bid();
  const ask = ctx.ask();
  if (bid == null || ask == null) return null;
  const mid = (bid + ask) / 2;
  if (mid <= 0) return null;

  // --- gather depth near the mid on each side ---
  let bidVol = 0, askVol = 0;
  for (const off of [0.001, 0.002, 0.003]) {
    const bd = ctx.depth('bid', mid * (1 - off));
    const ad = ctx.depth('ask', mid * (1 + off));
    if (typeof bd === 'number') bidVol += bd;
    if (typeof ad === 'number') askVol += ad;
  }
  // fallback: parse the book snapshot directly
  if (bidVol + askVol === 0) {
    const book = ctx.book();
    if (book && book.bids && book.asks) {
      const band = mid * 0.003;
      for (const lvl of book.bids) {
        const px = Array.isArray(lvl) ? Number(lvl[0]) : (lvl && (lvl.px != null ? Number(lvl.px) : Number(lvl.price)));
        if (px == null || mid - px > band) break;
        bidVol += Array.isArray(lvl) ? (Number(lvl[1]) || 0) : (lvl && (Number(lvl.qty != null ? lvl.qty : lvl.amount) || 0));
      }
      for (const lvl of book.asks) {
        const px = Array.isArray(lvl) ? Number(lvl[0]) : (lvl && (lvl.px != null ? Number(lvl.px) : Number(lvl.price)));
        if (px == null || px - mid > band) break;
        askVol += Array.isArray(lvl) ? (Number(lvl[1]) || 0) : (lvl && (Number(lvl.qty != null ? lvl.qty : lvl.amount) || 0));
      }
    }
  }

  const spreadPct = (ask - bid) / mid;
  let imb = 0;
  if (bidVol + askVol > 0) imb = (bidVol - askVol) / (bidVol + askVol); // +1 = all bid

  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;
  let stopPx = null;
  if (pos > 0 && entryPx != null) stopPx = entryPx * 0.988; // hard stop ~1.2% below entry

  const watch = [
    { side:'buy', price: mid, trigger:'below', note:'long on bid imbalance', conds:[{label:'imbalance>0.1', ok: imb > 0.1}] },
    { side:'sell', price: mid, trigger:'above', note:'exit when imbalance flips', conds:[{label:'imbalance<-0.05', ok: imb < -0.05}] }
  ];
  if (stopPx != null) watch.push({ side:'sell', price: stopPx, trigger:'below', note:'hard stop' });
  ctx.watch(watch);

  // exits
  if (pos > 0 && imb < -0.05) return { side:'sell', qty: pos, reduceOnly: true };
  if (pos > 0 && stopPx != null && ctx.price <= stopPx) return { side:'sell', qty: pos, reduceOnly: true };

  // entry: flat only, buy into a bid-heavy book
  if (pos === 0) {
    if (spreadPct > 0.002) return null; // skip wide books
    const qty = ctx.cash / ctx.price * 0.98;
    if (imb > 0.1) return { side:'buy', qty };
  }
  return null;
}
