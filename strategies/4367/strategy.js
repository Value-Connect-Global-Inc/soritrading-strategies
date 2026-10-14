/*
 * @coinsori-strategy v1
 * name: Donchian Basket DXY-Gated 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same proven multi-coin Donchian breakout recipe as the
 *   champion, but entries are gated by a MACRO regime: crypto tends to rally
 *   when the US dollar is weak and struggle when the dollar strengthens. This
 *   is a different data axis (macro) from the price-based 200-SMA filter that
 *   already failed, so it does not block entries in a bull while price is
 *   below its own long average.
 * When it buys and sells: buy on a fresh 55-bar high close (with close above
 *   100-EMA) only while the dollar index is below its own 60-day average.
 *   Sell on a 20-bar low close, a 2.5x ATR hard stop, or a close below the
 *   100-day EMA. The gate blocks new exposure while the dollar strengthens but
 *   does not force exits.
 * When it does NOT work: in a strong bull that runs against a strengthening
 *   dollar (rare), the gate keeps it in cash and it misses the rally; the
 *   dollar index is business-days-only so it is carried forward on weekends.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || atr <= 0 || ema100 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // macro gate: carry dxy forward (business-days only), keep 60-day history
  const st = ctx.state;
  if (!Array.isArray(st.dxyHist)) st.dxyHist = [];
  const dxy = ctx.data('dxy');
  if (dxy != null && Number.isFinite(dxy)) {
    st.dxyHist.push(dxy);
    if (st.dxyHist.length > 60) st.dxyHist.shift();
  }
  let dollarStrong = false;
  if (st.dxyHist.length >= 60) {
    const ma = st.dxyHist.reduce((a, b) => a + b, 0) / st.dxyHist.length;
    dollarStrong = st.dxyHist.at(-1) > ma;
  }

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA break' }]);
    return null;
  }

  const hh55 = ctx.high(55, 2);
  if (hh55 == null) return null;
  ctx.watch([{ side: 'buy', price: hh55, trigger: 'above', note: '55-bar breakout',
               conds: [{ label: 'close>100-EMA', ok: prevClose > ema100, closed: true },
                       { label: 'dollar weak', ok: !dollarStrong, closed: true }] }]);
  if (prevClose <= hh55) return null;
  if (prevClose < ema100) return null;
  if (dollarStrong) return null; // macro gate: no new exposure while dollar strengthens

  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.20; // cap each leg at 20% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
