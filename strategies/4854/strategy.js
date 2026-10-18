/*
 * @coinsori-strategy v1
 * name: BtcAdoptionTrend1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price follows network adoption in the long run — real usage (active
 * addresses) tends to lead price at cycle turns. Instead of price momentum, this uses on-chain activity
 * as the primary signal: buy when the network is growing AND price is above its 200-day average, sell
 * when either breaks. Different data source = different family from the momentum basket.
 * When it buys and sells: buys BTC when daily active addresses are above their 30-day average (adoption
 * expanding) AND price is above the 200-day SMA (long-term uptrend intact). Sells when price falls below
 * the 200-day SMA (trend broken) or adoption contracts below its 30-day average (network shrinking).
 * When it does NOT work: in a choppy sideways market the 200-day SMA flips often and the adoption signal
 * lags price, so it can buy high and sell low repeatedly. If on-chain data lags a real crash, the 200-day
 * SMA break is slow and loses more than a tight stop would. No per-trade stop beyond the trend break.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const sma200 = ctx.sma(200, 1); // long-term trend on closed bars
  const addr = ctx.data('addr'); // daily active BTC addresses
  const addrSma = ctx.data('addr_sma30'); // 30-day average of active addresses
  if (sma200 == null || addr == null || addrSma == null || addrSma <= 0) return null;

  const trendUp = px > sma200; // long-term uptrend intact
  const adoptionUp = addr > addrSma; // network usage expanding vs its own recent average
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: '200d SMA break',
                 conds: [{ label: 'adoption > 30d avg', ok: adoptionUp }] }]);
    if (!trendUp || !adoptionUp) { // exit on trend break OR adoption contraction
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: '200d SMA & adoption up',
               conds: [{ label: 'adoption > 30d avg', ok: adoptionUp }] }]);
  if (trendUp && adoptionUp) { // both the long trend and the network confirm a bull
    const qty = (ctx.cash / px) * 0.99; // single-coin: invest most of the account
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
