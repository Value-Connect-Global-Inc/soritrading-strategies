/*
 * @coinsori-strategy v1
 * name: FearGreed-Sentiment-Momentum Multi-Asset 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion is pure price momentum. This variant confirms
 * entries with SENTIMENT — the Crypto Fear & Greed Index above neutral (50)
 * means the crowd is not in panic mode, which historically accompanies sustained
 * rallies. This is different from the failed axes: it is NOT contrarian (buying
 * fear) and NOT a froth filter (refusing to buy above 75). It only refuses to
 * buy while sentiment is at/below neutral, so it still catches most of a rally
 * as long as the crowd is calm or greedy. It never blocks exits.
 * When it buys and sells: buys exactly like the champion (previous close above
 * the 200-day EMA AND 30-day return positive) AND the Fear & Greed Index is above
 * 50 (not panic). Sells on the 200-day EMA break, negative 30-day return, or 15%
 * hard stop.
 * When it does NOT work: in a rally that starts from deep fear and climbs while
 * F&G stays below 50 for a long time it misses the early move; and all crypto
 * majors are correlated, so a broad crash still hits every held leg.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  // Sentiment gate: Fear & Greed above neutral 50 (crowd not in panic).
  // Unknown = do NOT block (missing data must not force cash).
  let sentimentOk = true;
  const fg = ctx.data('fear_greed');
  if (fg != null) sentimentOk = fg > 50;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop || prevClose < ema200 || mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'F&G > 50', ok: sentimentOk, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !sentimentOk) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
