/*
 * @coinsori-strategy v1
 * name: On-Chain Network-Health Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion momentum rule is strong, but it buys purely on
 * price. This version adds a NON-PRICE fundamental gate: Bitcoin's daily active
 * addresses measure genuine user adoption. When addresses are above their 30-day
 * average, the network is growing and rallies are sustainable; when addresses
 * stagnate or fall, a rally is more likely speculative and prone to collapse.
 * Because Bitcoin is the market leader, its network health is used as a proxy
 * for the whole crypto market — every leg only buys while adoption is rising.
 * When it buys and sells: a leg buys when its previous close is above the 200-day
 * EMA AND its 30-day return is positive AND Bitcoin active addresses are above
 * their 30-day average. It sells on a 15% hard stop, a close below the 200-day
 * EMA, or fading 30-day momentum.
 * When it does NOT work: in a bull driven by speculation where prices rise faster
 * than user adoption, the address gate keeps it in cash and it misses the top of
 * the rally; and addresses are a lagging series, so the gate can stay green well
 * after the price has peaked.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // network health: Bitcoin active addresses above their 30-day average = adoption growing
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const networkHealthy = addr != null && addrSma != null && addrSma > 0 && addr > addrSma;

  // volatility-targeted sizing: ~2% daily vol per leg
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx => ctx.entryPx * 0.85;
    const stopPx = ctx.entryPx * 0.85;       // hard stop: 15% below entry
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'BTC addresses rising', ok: networkHealthy, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;
  if (!networkHealthy) return null;   // adoption gate: no buying while usage is shrinking

  const targetCash = ctx.cash * 0.33 * volScale;  // 1/3 of pool per leg, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
