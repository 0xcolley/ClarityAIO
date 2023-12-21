import { SPL_ACCOUNT_LAYOUT, TOKEN_PROGRAM_ID, TokenAccount } from "@raydium-io/raydium-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

export async function get_accounts_by_owner(connection: Connection, owner: PublicKey) {
    const token_resp = await connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
    const accounts: TokenAccount[] = [];

    for (const { pubkey, account } of token_resp.value) {
        accounts.push({
            pubkey,
            accountInfo:SPL_ACCOUNT_LAYOUT.decode(account.data),
            programId: TOKEN_PROGRAM_ID
        });
    }

    return accounts;
}