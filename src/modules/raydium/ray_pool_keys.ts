import { Liquidity, Market } from "@raydium-io/raydium-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

export async function fetch_pool_keys(connection: Connection, poolId: PublicKey, version :  4 | 5 = 4) {
    const serumVersion = 10;
    const marketVersion: 3 = 3;

    const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    const serumProgramId = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');

    const account = await connection.getAccountInfo(poolId);
    const { state: LiquidityStateLayout } = Liquidity.getLayouts(version);

    const fields = LiquidityStateLayout.decode(account?.data);
    const { status, baseMint, quoteMint, lpMint, openOrders, targetOrders, baseVault, quoteVault, marketId, baseDecimal, quoteDecimal } = fields;

    let withdrawQueue, lpVault;
    if (Liquidity.isV4(fields)) {
        withdrawQueue = fields.withdrawQueue;
        lpVault = fields.lpVault;
    }
    else {
        withdrawQueue = PublicKey.default;
        lpVault = PublicKey.default;
    }

    const associatedPoolKeys = Liquidity.getAssociatedPoolKeys({
        version: version,
        marketVersion,
        marketId,
        baseMint: baseMint,
        quoteMint:quoteMint,
        baseDecimals: baseDecimal.toNumber(),
        quoteDecimals: quoteDecimal.toNumber(),
        programId,
        marketProgramId:serumProgramId,
      });

      const poolKeys = {
        id: poolId,
        baseMint,
        quoteMint,
        lpMint,
        version,
        programId,
    
        authority: associatedPoolKeys.authority,
        openOrders,
        targetOrders,
        baseVault,
        quoteVault,
        withdrawQueue,
        lpVault,
        marketVersion: serumVersion,
        marketProgramId: serumProgramId,
        marketId,
        marketAuthority: associatedPoolKeys.marketAuthority,
      };

    const marketInfo = await connection.getAccountInfo(marketId);
    const { state: MARKET_STATE_LAYOUT } = Market.getLayouts(marketVersion);
    const market = MARKET_STATE_LAYOUT.decode(marketInfo.data);

    const {
        baseVault: marketBaseVault,
        quoteVault: marketQuoteVault,
        bids: marketBids,
        asks: marketAsks,
        eventQueue: marketEventQueue,
      } = market;

    return {
        ...poolKeys,
        ...{
            marketBaseVault,
            marketQuoteVault,
            marketBids,
            marketAsks,
            marketEventQueue,
        },
    };
}