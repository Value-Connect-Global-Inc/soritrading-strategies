/*
 * @coinsori-strategy v1
 * name: BTC 1D Fear-Greed Contrarian Dip
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index measures crowd sentiment. In crypto, extreme fear
 * (panic selling) inside a still-intact uptrend has historically marked good long entries, and
 * extreme greed marks good places to take profit. We bet on that mean-reversion of sentiment.
 * When it buys and sells: Buy when the index is at extreme fear (<= 25) while price still holds
 * above the 200-day average (the long-term uptrend is not broken). Sell when the index climbs
 * back to greed (>= 60), or when price closes below the 200-day average, or on a hard 2.5xATR
 * stop, or after 120 days without a recovery.
 * When it does NOT work: In a long bear market (like 2022) fear stays extreme for months while
 * price keeps falling — the uptrend filter keeps us out of most of it, but the few entries that
 * slip through bleed until the stop or trend exit fires.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const fg = ctx.data("fear_greed"); // 0-100 daily crowd sentiment, null before 2018
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || ema200 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const prevClose = ctx.closes.at(-2); // last closed bar (matches ago=1)

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    if (entryPx == null) { ctx.watch([]); return null; }
    const stop = entryPx - 2.5 * atr; // hard stop: 2.5x daily range below entry
    const st = ctx.state;
    if (st.entryBar == null) st.entryBar = ctx.i;

    const watch = [
      { side: 'sell', price: stop, trigger: 'below', note: 'stop' },
      { side: 'sell', price: prevClose, trigger: 'above', note: 'greed exit', conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 60, closed: true }] },
      { side: 'sell', price: ema200, trigger: 'below', note: 'trend broke' }
    ];
    // Take profit when sentiment reverts to greed; leave on a broken trend; stop on a hard loss.
    if (price <= stop || fg >= 60 || prevClose < ema200) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // Time exit: 120 days without recovering to greed means the dip was not a dip.
    if (ctx.i - st.entryBar >= 120) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  // Flat: contrarian buy at extreme fear, only while the long-term trend is still up.
  const uptrend = prevClose > ema200;
  const watch = [{
    side: 'buy', price: prevClose, trigger: 'below', note: 'fear dip buy',
    conds: [
      { label: 'Fear&Greed', now: fg, op: '<=', ref: 25, closed: true },
      { label: 'EMA200 uptrend', ok: uptrend }
    ]
  }];
  // 25 = classic "extreme fear" band boundary; entry is sentiment-triggered, not price-triggered.
  if (fg <= 25 && uptrend) {
    const st = ctx.state;
    st.entryBar = ctx.i;
    const qty = (ctx.cash / price) * 0.98;
    ctx.watch(watch);
    return { side: 'buy', qty };
  }
  ctx.watch(watch);
  return null;
}
