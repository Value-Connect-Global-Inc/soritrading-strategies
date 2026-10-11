/*
 * @coinsori-strategy v1
 * name: FearAndHashrateMultiFactor4h
 * ex: binance
 * syms: BTC/USDT, BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Combines on-chain miner health (Hashrate trend) and market sentiment (Fear & Greed) with price momentum to capture robust crypto cycles.
 * When it buys and sells: Buys when Fear & Greed is recovering from fear and Hashrate is rising above its moving average alongside positive price SMA crossover; sells when sentiment turns overly greedy or momentum reverses.
 * When it does not work: Suffers in prolonged range-bound markets or sudden macro liquidity shocks where sentiment and fundamentals decouple from price.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const s50 = ctx.sma(50);
    const s200 = ctx.sma(200);
    const rsi = ctx.rsi(14);
    
    // Read external datasets: Fear & Greed index and Hashrate
    const fgVal = ctx.data('fg');
    const hashVal = ctx.data('hashrate');
    const hashSma = ctx.data('hashrate_sma30');

    if (s50 == null || s200 == null || rsi == null || fgVal == null || hashVal == null || hashSma == null) {
        return null;
    }

    const pos = ctx.position;
    const cash = ctx.cash;

    // Conditions:
    // 1. Technical trend: Price > SMA50 and SMA50 > SMA200
    const techBull = (p > s50 && s50 > s200);
    // 2. Fundamental/Sentiment: Fear & Greed > 30 (not extreme fear) and Hashrate > Hashrate SMA30 (miner growth)
    const fundamentalOk = (fgVal > 30 && hashVal > hashSma);
    // 3. Momentum filter: RSI not overbought
    const rsiOk = (rsi < 65);

    if (pos <= 0 && techBull && fundamentalOk && rsiOk) {
        ctx.watch([
            { side: 'buy', price: p, trigger: 'above', note: 'Multi-factor Bull Entry', conds: [
                { label: 'Tech Bull', ok: true },
                { label: 'Fundamental Ok', ok: true },
                { label: 'RSI < 65', now: rsi, op: '<', ref: 65, closed: true }
            ]}
        ]);
        return { side: 'buy', qty: (cash / p) * 0.99 };
    }

    // Exit conditions: Trend breakdown or extreme greed / overbought
    const exitCondition = (p < s50 || rsi > 80 || fgVal > 85);
    if (pos > 0 && exitCondition) {
        ctx.watch([
            { side: 'sell', price: p, trigger: 'below', note: 'Multi-factor Exit', conds: [
                { label: 'Trend Breakdown / Greed', ok: true }
            ]}
        ]);
        return { side: 'sell', qty: pos };
    }

    ctx.watch([
        { side: 'buy', price: s50, trigger: 'below', note: 'Waiting for pullback to SMA50' }
    ]);
    return null;
}
