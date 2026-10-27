/*
 * @coinsori-strategy v1
 * name: BTC-ETH-SOL VolTarget Defensive Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The single-asset BTC vol-target (5550) is the validated winner, but its
 * 47-56% drawdown comes from being 100% concentrated in one coin. This basket runs the same
 * proven inverse-volatility engine across BTC, ETH and SOL, each capped at one third of the
 * account. It stays ALWAYS invested in crypto (never goes to cash) so it still captures the
 * violent V-recoveries that made 5550 work — but a single coin's crash now only hurts one
 * third of the account, not all of it.
 * When it buys and sells: Every day each coin is sized by inverse 14-day ATR (low volatility =
 * big position, high volatility = small position), targeting a 2.5% daily-vol budget per coin,
 * rebalanced only when the target moves more than 20%. It never fully exits any coin.
 * When it does NOT work: In a broad crypto bear where BTC, ETH and SOL fall together, the
 * basket still bleeds — diversification only helps when coins diverge. It also lags pure-BTC
 * buy-and-hold in a BTC-led bull because part of the account sits in laggards.
 *
 * v17 improvement (cycle 17): each coin's exposure is capped at HALF when its price trades
 * below its 200-day moving average (a sustained downtrend). This is the standard crypto
 * bull/bear line and directly targets the documented weakness above — the basket no longer
 * rides a broad bear at full size. The filter was chosen before any backtest, not fitted
 * to any specific crash.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  const sym = ctx.sym;
  const pos = ctx.pos(sym);

  // Total portfolio equity = liquid cash + market value of all open positions.
  // Needed so buying one coin does not shrink the sizing base of the others.
  let equity = ctx.cash;
  const positions = ctx.positions;
  if (positions != null) {
    const list = Array.isArray(positions) ? positions : Object.values(positions);
    for (const p of list) {
      if (p != null && p.qty > 0 && p.price > 0) equity += p.qty * p.price;
    }
  }
  if (equity <= 0) return null;

  const SLICE = 1 / 3;      // 3 coins, equal notional share of the account
  const TARGET_VOL = 0.025; // same daily-vol budget as the validated single-asset version 5550
  const realizedVol = atr / price; // ATR as a fraction of price = daily vol proxy
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0); // never more than fully invested in a coin
  if (frac < 0.05) frac = 0.05; // stay minimally invested even in extreme vol

  // Bear-market de-risk: price under the 200-day SMA = sustained downtrend -> cap at half size.
  // Standard crypto bull/bear line; chosen before any backtest, not fitted to a crash.
  const sma200 = ctx.sma(200, 1);
  if (sma200 != null && price < sma200) {
    frac = Math.min(frac, 0.5);
  }

  const qtyTarget = SLICE * frac * equity / price;

  // Rebalance only when the target moved materially — 20% band cuts fee churn.
  const threshold = 0.20;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }

  if (qtyTarget > pos) {
    const qty = qtyTarget - pos;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'vol-target rebalance up' }]);
    return { side: 'buy', qty: qty };
  }
  if (qtyTarget < pos) {
    const qty = pos - qtyTarget;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'sell', qty: qty, reduceOnly: true, note: 'vol-target rebalance down' }]);
    return { side: 'sell', qty: qty, reduceOnly: true };
  }
  return null;
}
