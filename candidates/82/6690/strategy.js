/*
 * @coinsori-strategy v1
 * name: BTC VIX-Sized Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Uses the US VIX (equity fear gauge) to SIZE the position instead of switching it
 * fully on/off. In an uptrend it holds BTC, but exposure shrinks as VIX fear rises
 * and grows back as fear fades — so it keeps most of the recovery rallies while
 * taking less drawdown during panic. Cross-asset signal, 2-day lag.
 * Does not work in a slow silent bear where VIX stays low while BTC grinds down —
 * the fear signal cannot catch a drift, only a panic.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  const cash = ctx.cash;

  const vix = ctx.data("base_vix");
  if (vix == null) return null; // no regime signal -> no trade (honest)

  const sma = ctx.sma(100, 1);
  if (sma == null) return null;

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rolling VIX z-score: how fearful today is vs the last ~10 weeks
  const hist = ctx.state.vixHist || [];
  hist.push(vix);
  if (hist.length > 400) hist.shift();
  ctx.state.vixHist = hist;

  let vixZ = 0;
  if (hist.length >= 60) {
    const n = hist.length;
    const mean = hist.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    if (sd > 1e-9) vixZ = (vix - mean) / sd;
  }

  const atr = ctx.atr(14, 1);
  const inUptrend = prevClose > sma;

  // exposure shrinks as fear rises, but never to zero (keeps recoveries)
  const target = vixZ > 2 ? 0.2 : vixZ > 1.2 ? 0.4 : vixZ > 0.3 ? 0.7 : 1.0;

  if (pos > 0) {
    const stop = (ctx.entryPx != null && atr != null) ? ctx.entryPx - 3 * atr : null;
    const exits = [
      { side: 'sell', price: sma, trigger: 'below', note: 'trend break' }
    ];
    if (stop != null) exits.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
    ctx.watch(exits);

    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (!inUptrend) return { side: 'sell', qty: pos, reduceOnly: true };

    // trim exposure when fear rises (only crosses a band, so rare)
    const targetQty = cash / price * target;
    if (pos > targetQty * 1.1) return { side: 'sell', qty: pos - targetQty, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma, trigger: 'above', note: 'SMA100 uptrend', conds: [{ label: 'VIX z', now: Math.round(vixZ * 10) / 10, op: '<', ref: 2 }] }
  ]);

  if (inUptrend) {
    return { side: 'buy', qty: cash / price * target };
  }
  return null;
}
