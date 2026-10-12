/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is driven heavily by crowd emotion. When the Fear & Greed
 * index is deep in fear, the crowd has already sold — that is when risk/reward is best.
 * This is a contrarian sentiment strategy: it buys as panic starts to lift and sells as
 * euphoria peaks, the opposite of trend-following.
 * When it buys and sells: buys when the Fear & Greed index crosses UP out of the extreme
 * fear zone (below 25); sells when it reaches the extreme greed zone (above 75) or on a
 * hard 2x ATR stop below entry.
 * When it does NOT work: in a prolonged bear market fear can stay extreme for months and
 * a panic-lift is a dead-cat bounce — the 2x ATR stop caps each loss but the strategy
 * can bleed many small losses. It also sits in cash for most of a strong bull market
 * waiting for a fear spike that never comes.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  if (fg == null) return null;
  const s = ctx.state;
  const prevFg = s.prevFg;
  s.prevFg = fg;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx - 2 * atr; // hard stop: one bad trade must not sink the account
    if (price <= stop || fg > 75) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: null, trigger: 'above', note: 'greed>75 exit' }]);
    return null;
  }

  // Buy only when panic starts to LIFT (prev below 25, now at/above 25) — avoids buying the falling knife.
  if (prevFg != null && prevFg < 25 && fg >= 25) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: null, trigger: 'below', note: 'fg<25 panic', conds: [{ label: 'fear lifting', now: fg, op: '>=', ref: 25, closed: true }] }]);
  return null;
}
