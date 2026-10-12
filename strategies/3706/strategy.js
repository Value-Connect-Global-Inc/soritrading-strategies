/*
 * @coinsori-strategy v1
 * name: FearGreedMeanReversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto sentiment swings to extremes — panic (extreme fear)
 * and euphoria (extreme greed). Buying when the crowd is deeply fearful and
 * selling when the crowd is euphoric has historically been a contrarian edge on
 * Bitcoin. The Fear & Greed index is a direct, daily measure of that crowd mood.
 * When it buys and sells: buy BTC when the Fear & Greed index is deeply fearful
 * (below 20) — the crowd has given up and prices are often washed out. Sell when
 * the index turns greedy (above 60) or price falls below a protective ATR stop.
 * When it does NOT work: in a prolonged bear market the index can stay in extreme
 * fear for months while price keeps falling — buying every deep-fear print
 * catches falling knives. Also the index only updates daily, so intraday moves
 * are invisible to it. It is a slow, long-horizon strategy, not a scalper.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const fg = Number(ctx.data('fear_greed'));
  const atr = ctx.atr(14, 1);
  if (!Number.isFinite(fg) || fg <= 0 || atr == null || atr <= 0) return null;

  const st = ctx.state;
  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 3 * atr;
    // Exit on euphoria (greed above 60) or the protective stop. 3x ATR gives a
    // wide stop so a single volatile day does not shake us out of a contrarian
    // position that may take weeks to pay off.
    if (fg > 60 || price <= hardStop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR stop' },
               { side: 'sell', price: null, trigger: 'above', note: 'greed exit' }]);
    return null;
  }

  // Contrarian entry: only buy on deep fear (index below 20). This is the core
  // bet — the crowd is capitulating and the risk/reward is usually favorable.
  if (fg < 20) {
    // Size to risk 1% of equity via the 3x ATR stop, capped at 50% of equity.
    const riskPerTrade = 0.01 * ctx.cash;
    let qty = riskPerTrade / (3 * atr);
    const maxQty = (ctx.cash / price) * 0.50;
    qty = Math.min(qty, maxQty);
    ctx.watch([]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: null, trigger: 'below', note: 'deep fear entry',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 20, closed: true }] }]);
  return null;
}
