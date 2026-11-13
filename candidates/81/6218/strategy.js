/*
 * @coinsori-strategy v1
 * name: Crypto Momentum Rotation 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: medium-term crypto momentum (the 33-day winner keeps winning for weeks); rotating into the strongest coin and out of the weakest captures the trend without betting on any single coin forever.
 * When it buys and sells: every bar it ranks all coins by 200-bar momentum; it holds the #1 coin and switches only when a new leader beats it by a clear 5pp margin. If even the leader is down over 33 days it holds nothing. A 10% stop protects each position.
 * When it does NOT work: in choppy markets where the leader changes often it churns and pays fees, and in a crash all coins fall together so rotation cannot hide (it steps aside and misses the later rebound).
 */
function onUpdate(ctx) {
  const N = 200;       // 33 days at 4h: medium-term momentum, stable ranking
  const MARGIN = 0.05; // switch only if new leader beats holder by 5pp (kills flip-flop churn)
  const MINHOLD = 48;  // hold at least 8 days before switching leaders
  const STOP = 0.10;   // 10% hard stop: crypto 4h swings make tighter stops get wicked out
  const COOLDOWN = 100; // after a stop, wait ~16 days before re-entering same coin

  const st = ctx.state;
  if (!st.closes) st.closes = {};
  if (!st.entryBar) st.entryBar = {};
  if (!st.stopBar) st.stopBar = {};

  const arr = st.closes[ctx.sym] || (st.closes[ctx.sym] = []);
  arr.push(ctx.price);
  if (arr.length > N + 2) arr.shift();

  const syms = (ctx.syms && ctx.syms.length) ? ctx.syms : [ctx.sym];
  for (const s of syms) {
    const a = st.closes[s];
    if (!a || a.length < N) { ctx.watch([]); return null; }   // warm-up: need N bars for every coin
  }

  let best = null, bestM = -Infinity;
  for (const s of syms) {
    const a = st.closes[s];
    const m = a[a.length - 1] / a[a.length - N] - 1;
    if (m > bestM) { bestM = m; best = s; }
  }

  // broad weakness: even the leader is down over 33 days, so hold nothing
  if (bestM <= 0) {
    if (ctx.position > 0) {
      ctx.watch([{ side:'sell', price: ctx.price, trigger:'below', note:'leader falling, exit' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  // hard stop: leave a loser even if it is still #1 (protection beats rank purity)
  if (ctx.position > 0 && ctx.entryPx != null && ctx.price < ctx.entryPx * (1 - STOP)) {
    st.stopBar[ctx.sym] = ctx.i;
    ctx.watch([{ side:'sell', price: ctx.entryPx * (1 - STOP), trigger:'below', note:'10% stop' }]);
    return { side:'sell', qty: ctx.position, reduceOnly: true };
  }

  // cooldown after a stop-out: give the coin time to settle before re-entering
  const lastStop = st.stopBar[ctx.sym] || -Infinity;
  if (ctx.position <= 0 && ctx.i - lastStop < COOLDOWN) {
    ctx.watch([]);
    return null;
  }

  if (ctx.sym === best) {
    if (ctx.position <= 0) {
      st.entryBar[ctx.sym] = ctx.i;
      ctx.watch([{ side:'buy', price: ctx.price, trigger:'below', note:'top momentum', conds:[{ label:'rank 1', ok:true }] }]);
      return { side:'buy', qty: ctx.cash / ctx.price * 0.98 };
    }
    ctx.watch([{ side:'sell', price: ctx.entryPx != null ? ctx.entryPx * (1 - STOP) : ctx.price * 0.9, trigger:'below', note:'10% stop' }]);
    return null;
  }

  // not the leader: switch only when the new leader is clearly stronger AND we held long enough
  if (ctx.position > 0) {
    const myA = st.closes[ctx.sym];
    const myM = myA[myA.length - 1] / myA[myA.length - N] - 1;
    const heldFor = ctx.i - (st.entryBar[ctx.sym] || ctx.i);
    if (bestM > myM + MARGIN && heldFor >= MINHOLD) {
      ctx.watch([{ side:'sell', price: ctx.price, trigger:'below', note:'lost top rank' }]);
      return { side:'sell', qty: ctx.position, reduceOnly: true };
    }
    ctx.watch([{ side:'sell', price: ctx.entryPx != null ? ctx.entryPx * (1 - STOP) : ctx.price * 0.9, trigger:'below', note:'10% stop' }]);
    return null;
  }
  ctx.watch([]);
  return null;
}
