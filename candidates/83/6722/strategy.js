/*
 * @coinsori-strategy v1
 * name: Book Imbalance Mean Reversion 5m
 * ex: binance
 * syms: BTC/USDT
 * interval: 5m
 * cash: 1000
 *
 * Order-book imbalance near the touch predicts short-term drift: when bid
 * depth within a small band of the best bid outweighs ask depth, buyers are
 * stacked and price tends to drift up over the next few bars. We buy only
 * when the spread is tight (liquid book) and bid depth clearly dominates,
 * then exit on the opposite imbalance, a take-profit, a stop-loss or a max
 * holding time. It does NOT work in thin books (wide spread) or in fast
 * one-sided sweeps where the book is taken out faster than we can react.
 */
function onUpdate(ctx) {
  const bid = ctx.bid();
  const ask = ctx.ask();
  let mid = null, spreadPct = null;
  if (bid != null && ask != null && ask > bid) {
    mid = (bid + ask) / 2;
    spreadPct = (ask - bid) / mid;
  }

  // Imbalance only when the book is liquid enough that spread cost is minor.
  let imb = null;
  if (mid != null && spreadPct != null && spreadPct <= 0.0008) { // 0.08% — BTC 5m book is usually far tighter
    const band = 0.003; // depth within 0.3% of the touch on each side
    const bd = ctx.depth('bid', bid * (1 - band));
    const ad = ctx.depth('ask', ask * (1 + band));
    if (bd != null && ad != null) {
      const tot = bd + ad;
      if (tot > 0) imb = (bd - ad) / tot; // +1 = buyers dominate, -1 = sellers dominate
    }
  }

  const pos = ctx.position;
  const entryPx = ctx.entryPx;
  const st = ctx.state || {};
  const bar = ctx.i;
  const MAX_HOLD = 24; // 2 hours on 5m — the imbalance edge is short-horizon

  const w = [];
  if (mid != null && imb != null) {
    w.push({ side:'buy', price: mid, trigger:'below', note:'OBI buy',
      conds:[ {label:'OBI', now: imb, op:'>', ref: 0.3, closed:false},
              {label:'spread%', now: spreadPct*100, op:'<', ref: 0.08, closed:false} ] });
  }
  if (pos > 0 && entryPx != null) {
    w.push({ side:'sell', price: entryPx * 1.004, trigger:'above', note:'TP 0.4%' });
    w.push({ side:'sell', price: entryPx * 0.995, trigger:'below', note:'SL 0.5%' });
  }
  if (pos > 0 && st.entryBar != null) {
    const remain = Math.max(1, MAX_HOLD - (bar - st.entryBar));
    w.push({ side:'sell', at: ctx.times.at(-1) + remain * 300, note:'max hold' });
  }
  ctx.watch(w);

  if (imb == null) return null;

  if (pos > 0) {
    let reason = null;
    if (entryPx != null && ctx.price >= entryPx * 1.004) reason = 'tp';
    else if (entryPx != null && ctx.price <= entryPx * 0.995) reason = 'sl';
    else if (imb < -0.3 && st.entryBar != null && bar - st.entryBar >= 2) reason = 'obi';
    else if (st.entryBar != null && bar - st.entryBar >= MAX_HOLD) reason = 'time';
    if (reason != null) {
      ctx.state = st;
      st.lastExitBar = bar;
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Cooldown: wait a few bars after an exit before re-entering.
  if (st.lastExitBar != null && bar - st.lastExitBar < 3) return null;

  // Buy only when buyers clearly dominate the near-touch book.
  if (imb > 0.3) {
    ctx.state = st;
    st.entryBar = bar;
    return { side:'buy', qty: (ctx.cash * 0.98) / ctx.price };
  }
  return null;
}
