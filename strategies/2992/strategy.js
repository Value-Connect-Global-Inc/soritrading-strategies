/*
 * @coinsori-strategy v1
 * name: BTC 1D Deep-Crash Capitulation Reversion
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A DIFFERENT behavioural bet from the short-term Keltner pullback
 * champion. This buys deep panic capitulation: after BTC has crashed a long way from
 * its recent high and volatility has spiked, the market tends to snap back. It is a
 * long-horizon deep-value reversion, not a short-term band bounce.
 * When it buys and sells: Buy when price is far (>=25%) below its N-day high AND the
 * 14-day RSI is deeply oversold (<25) — a capitulation flush. Sell after a strong
 * bounce (price back above the 20-day EMA) or if the trade goes further against us
 * (stop below the entry by 2.5x ATR). Stay flat otherwise.
 * When it does NOT work: In a sustained bear market a "crash" keeps crashing — the
 * stop limits the loss but the strategy repeatedly buys falling knives. It also misses
 * all normal uptrends (no trend-following), so in a long bull it underperforms buy-and-hold.
 * 2026-05-09 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  const ema20 = ctx.ema(20, 1);
  const high90 = ctx.high(90, 1);
  if (rsi == null || atr == null || ema20 == null || high90 == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    // Declare what we are waiting for: EMA20 bounce exit and hard stop.
    const watchEntries = [
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 bounce exit' }
    ];
    if (ctx.entryPx != null) {
      watchEntries.push({ side: 'sell', price: ctx.entryPx - 2.5 * atr, trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(watchEntries);

    // Exit on a strong bounce above the 20-day EMA (capitulation recovered).
    if (price > ema20) {
      return { side: 'sell', qty: pos };
    }
    // Hard stop: if the crash deepens 2.5x ATR below entry, cut the loss.
    if (ctx.entryPx != null && price < ctx.entryPx - 2.5 * atr) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Deep-crash entry: price at least 25% below its 90-day high AND RSI deeply oversold.
  const crashDepth = 1 - price / high90;
  ctx.watch([
    {
      side: 'buy',
      price: high90 * 0.75,
      trigger: 'below',
      note: 'deep crash entry',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 25, closed: true }
      ]
    }
  ]);

  if (crashDepth >= 0.25 && rsi < 25) {
    const equity = ctx.cash + ctx.uPnl;
    const qty = (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash) / price;
    return { side: 'buy', qty: qty * 0.98 };
  }
  return null;
}
