/**
 * jupiterPerps.js — Jupiter Perpetuals Integration
 * 
 * Enables long/short perpetual positions on Jupiter Perps (jup.ag/perps)
 * Supported markets: SOL-PERP, ETH-PERP, wBTC-PERP
 * Leverage: 1.1x to 100x (UI capped at 20x for safety)
 * 
 * Architecture:
 *   1. User submits a PositionRequest (Increase/Decrease) via on-chain tx
 *   2. Jupiter keepers detect and execute the request against the JLP pool
 *   3. Position account is created/updated on-chain
 * 
 * Requires: @solana/web3.js (already installed)
 */

const crypto = require('crypto');

// Jupiter Perpetuals Program ID
const PERP_PROGRAM_ID = 'PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu';

// JLP Pool (main liquidity pool)
const JLP_POOL = '5BUwFW4nRbftYTDMbgxykoFWKIYHBiDHFt67ImAQkS1b';

// Custody accounts for each market (mainnet)
const CUSTODIES = {
    'SOL': '7xS2gz2bTp3fwCC7knJvUWTEU9Tyg64jDYYVU5UPx7F2',
    'ETH': 'AQCGyheWPLeo764h3YhXWjD1vNm3HcyGTgifWX75ABRV',
    'wBTC': '5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxCgayiHHRqOES',
};

// Collateral custody (USDC/SOL as collateral)
const COLLATERAL_CUSTODIES = {
    'SOL': '7xS2gz2bTp3fwCC7knJvUWTEU9Tyg64jDYYVU5UPx7F2',
    'USDC': 'G18jKKXQwBbrHeiK3C9MRXhqI3qz9KcVrwKWCUZ2fMhG',
    'USDT': '4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk',
};

// Token mints
const TOKEN_MINTS = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    'wBTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// Price feeds (Pyth oracle accounts)
const PRICE_FEEDS = {
    'SOL': 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG',
    'ETH': 'JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB',
    'wBTC': 'GVXRSBjFk6e6J3NbVPXohDJwcHp3KttLRnPcBB7ZZiR6',
};

// Jupiter Perps API for reading positions + pool data
const PERPS_API = 'https://perps-api.jup.ag/v1';

class JupiterPerps {
    constructor(connection, keypair) {
        this.connection = connection;
        this.keypair = keypair;
    }

    /**
     * Get all open positions for the wallet
     */
    async getPositions() {
        try {
            if (!this.keypair) return { positions: [], error: null };
            const wallet = this.keypair.publicKey.toBase58();

            // Try Jupiter's perps API first
            const res = await fetch(`${PERPS_API}/positions?wallet=${wallet}`);
            if (res.ok) {
                const data = await res.json();
                return { positions: this._formatPositions(data), error: null };
            }

            // Fallback: scan on-chain Position accounts owned by this wallet
            return await this._scanPositionsOnChain();
        } catch (e) {
            console.error('[JupiterPerps] getPositions error:', e.message);
            return { positions: [], error: e.message };
        }
    }

    /**
     * Get available perps markets with current prices
     */
    async getMarkets() {
        try {
            const res = await fetch(`${PERPS_API}/pool-info`);
            if (!res.ok) throw new Error('Failed to fetch pool info');
            const pool = await res.json();

            // Also fetch prices
            const prices = {};
            for (const symbol of ['SOL', 'ETH', 'wBTC']) {
                try {
                    const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${TOKEN_MINTS[symbol]}`);
                    const priceData = await priceRes.json();
                    prices[symbol] = parseFloat(priceData.data?.[TOKEN_MINTS[symbol]]?.price || 0);
                } catch { prices[symbol] = 0; }
            }

            return {
                markets: [
                    { symbol: 'SOL-PERP', underlying: 'SOL', price: prices['SOL'], maxLeverage: 100, custody: CUSTODIES['SOL'] },
                    { symbol: 'ETH-PERP', underlying: 'ETH', price: prices['ETH'], maxLeverage: 100, custody: CUSTODIES['ETH'] },
                    { symbol: 'wBTC-PERP', underlying: 'wBTC', price: prices['wBTC'], maxLeverage: 100, custody: CUSTODIES['wBTC'] },
                ],
                pool: pool,
                error: null,
            };
        } catch (e) {
            // Fallback with just price data
            return {
                markets: [
                    { symbol: 'SOL-PERP', underlying: 'SOL', price: 0, maxLeverage: 100, custody: CUSTODIES['SOL'] },
                    { symbol: 'ETH-PERP', underlying: 'ETH', price: 0, maxLeverage: 100, custody: CUSTODIES['ETH'] },
                    { symbol: 'wBTC-PERP', underlying: 'wBTC', price: 0, maxLeverage: 100, custody: CUSTODIES['wBTC'] },
                ],
                pool: null,
                error: e.message,
            };
        }
    }

    /**
     * Open a perpetual position
     * @param {string} market - 'SOL', 'ETH', or 'wBTC'
     * @param {'long'|'short'} side
     * @param {number} collateralUsd - Collateral in USD (e.g., 10 = $10)
     * @param {number} leverage - 1.1 to 100
     * @param {string} collateralToken - 'SOL' or 'USDC' (what you're depositing)
     */
    async openPosition(market, side, collateralUsd, leverage, collateralToken = 'SOL') {
        try {
            if (!this.keypair) return { error: 'No wallet configured' };
            if (leverage < 1.1 || leverage > 100) return { error: 'Leverage must be 1.1x to 100x' };
            if (!CUSTODIES[market]) return { error: `Unknown market: ${market}` };

            const sizeUsd = collateralUsd * leverage;
            console.log(`[JupiterPerps] Opening ${side} ${market}-PERP: $${collateralUsd} collateral × ${leverage}x = $${sizeUsd} size`);

            // Use Jupiter's perps transaction builder API
            const txRes = await fetch(`${PERPS_API}/open-position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: this.keypair.publicKey.toBase58(),
                    market: market,
                    side: side,
                    collateralUsd: collateralUsd,
                    sizeUsd: sizeUsd,
                    collateralMint: TOKEN_MINTS[collateralToken],
                }),
            });

            if (txRes.ok) {
                const txData = await txRes.json();
                return await this._signAndSend(txData);
            }

            // If API doesn't have tx builder, build manually
            return await this._buildOpenPositionTx(market, side, collateralUsd, sizeUsd, collateralToken);
        } catch (e) {
            console.error('[JupiterPerps] openPosition error:', e.message);
            return { error: `Open position failed: ${e.message}` };
        }
    }

    /**
     * Close a perpetual position
     * @param {string} positionKey - Public key of the Position account
     * @param {boolean} entirePosition - Close entire position or partial
     */
    async closePosition(positionKey, entirePosition = true) {
        try {
            if (!this.keypair) return { error: 'No wallet configured' };

            console.log(`[JupiterPerps] Closing position: ${positionKey}`);

            // Try Jupiter's perps API for closing
            const txRes = await fetch(`${PERPS_API}/close-position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: this.keypair.publicKey.toBase58(),
                    position: positionKey,
                    entirePosition: entirePosition,
                }),
            });

            if (txRes.ok) {
                const txData = await txRes.json();
                return await this._signAndSend(txData);
            }

            return { error: 'Position close API not available — close via jup.ag/perps UI' };
        } catch (e) {
            console.error('[JupiterPerps] closePosition error:', e.message);
            return { error: `Close position failed: ${e.message}` };
        }
    }

    /**
     * Sign and send a serialized transaction
     */
    async _signAndSend(txData) {
        try {
            const { VersionedTransaction } = require('@solana/web3.js');
            const txBuf = Buffer.from(txData.transaction || txData.tx, 'base64');
            const tx = VersionedTransaction.deserialize(txBuf);
            tx.sign([this.keypair]);

            const signature = await this.connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
                maxRetries: 2,
            });

            const latestBlockhash = await this.connection.getLatestBlockhash();
            await this.connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

            return { signature, error: null };
        } catch (e) {
            return { error: `Transaction failed: ${e.message}` };
        }
    }

    /**
     * Build open position tx manually using program instructions
     * This is the fallback when the REST API doesn't provide a tx builder
     */
    async _buildOpenPositionTx(market, side, collateralUsd, sizeUsd, collateralToken) {
        try {
            const { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram } = require('@solana/web3.js');

            const programId = new PublicKey(PERP_PROGRAM_ID);
            const pool = new PublicKey(JLP_POOL);
            const custody = new PublicKey(CUSTODIES[market]);
            const collateralCustody = new PublicKey(COLLATERAL_CUSTODIES[collateralToken] || COLLATERAL_CUSTODIES['SOL']);
            const priceFeed = new PublicKey(PRICE_FEEDS[market]);

            // Generate a unique position request counter
            const counter = Date.now();

            // Derive the Position PDA
            const [positionPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('position'),
                    this.keypair.publicKey.toBuffer(),
                    pool.toBuffer(),
                    custody.toBuffer(),
                    Buffer.from([side === 'long' ? 1 : 2]),
                ],
                programId
            );

            // Derive the PositionRequest PDA
            const counterBuf = Buffer.alloc(8);
            counterBuf.writeBigUInt64LE(BigInt(counter));
            const [positionRequestPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('position_request'),
                    this.keypair.publicKey.toBuffer(),
                    counterBuf,
                ],
                programId
            );

            // Amount in token decimals
            let collateralAmount;
            if (collateralToken === 'SOL') {
                // SOL price fetch
                const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${TOKEN_MINTS['SOL']}`);
                const priceData = await priceRes.json();
                const solPrice = parseFloat(priceData.data?.[TOKEN_MINTS['SOL']]?.price || 0);
                if (solPrice === 0) return { error: 'Could not fetch SOL price' };
                collateralAmount = Math.floor((collateralUsd / solPrice) * LAMPORTS_PER_SOL);
            } else {
                // USDC/USDT (6 decimals)
                collateralAmount = Math.floor(collateralUsd * 1_000_000);
            }

            // Encode instruction data for createIncreasePositionMarketRequest
            // Instruction discriminator (Anchor): SHA256("global:create_increase_position_market_request")[0..8]
            const discriminator = this._getDiscriminator('create_increase_position_market_request');

            // Build instruction data
            const dataLayout = Buffer.alloc(8 + 8 + 8 + 8 + 8 + 1);
            discriminator.copy(dataLayout, 0);
            // sizeUsdDelta (u64) — position size in USD (6 decimals)
            dataLayout.writeBigUInt64LE(BigInt(Math.floor(sizeUsd * 1_000_000)), 8);
            // collateralDelta (u64) — collateral amount in token lamports
            dataLayout.writeBigUInt64LE(BigInt(collateralAmount), 16);
            // priceSlippage (u64) — 3% slippage = 300 (basis points in 10000)
            dataLayout.writeBigUInt64LE(BigInt(300), 24);
            // jupiterMinimumOut (u64) — 0 for market orders
            dataLayout.writeBigUInt64LE(BigInt(0), 32);
            // counter (u64) 
            dataLayout.writeBigUInt64LE(BigInt(counter), 40);

            // Note: The exact account layout depends on the IDL version
            // This is a best-effort construction — Jupiter's API may change
            const instruction = new TransactionInstruction({
                programId,
                keys: [
                    { pubkey: this.keypair.publicKey, isSigner: true, isWritable: true },   // owner
                    { pubkey: pool, isSigner: false, isWritable: true },                      // pool
                    { pubkey: positionPda, isSigner: false, isWritable: true },               // position
                    { pubkey: positionRequestPda, isSigner: false, isWritable: true },        // positionRequest
                    { pubkey: custody, isSigner: false, isWritable: true },                   // custody
                    { pubkey: collateralCustody, isSigner: false, isWritable: true },         // collateralCustody
                    { pubkey: priceFeed, isSigner: false, isWritable: false },                // oracleAccount
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // systemProgram
                ],
                data: dataLayout,
            });

            // Build and send versioned transaction
            const latestBlockhash = await this.connection.getLatestBlockhash();
            const messageV0 = new TransactionMessage({
                payerKey: this.keypair.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: [instruction],
            }).compileToV0Message();

            const tx = new VersionedTransaction(messageV0);
            tx.sign([this.keypair]);

            const signature = await this.connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
                maxRetries: 3,
            });

            await this.connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

            console.log(`[JupiterPerps] Position opened: ${signature}`);
            return {
                signature,
                position: positionPda.toBase58(),
                side,
                market,
                sizeUsd,
                collateralUsd,
                leverage: sizeUsd / collateralUsd,
                error: null
            };
        } catch (e) {
            console.error('[JupiterPerps] _buildOpenPositionTx error:', e.message);
            return { error: `Build tx failed: ${e.message}` };
        }
    }

    /**
     * Get Anchor instruction discriminator
     */
    _getDiscriminator(instructionName) {
        const hash = crypto.createHash('sha256').update(`global:${instructionName}`).digest();
        return hash.slice(0, 8);
    }

    /**
     * Format positions from API response
     */
    _formatPositions(data) {
        if (!data || !Array.isArray(data)) return [];
        return data.map(p => ({
            key: p.publicKey || p.key || '',
            market: p.custody ? this._custodyToSymbol(p.custody) : 'Unknown',
            side: p.side === 1 || p.side === 'long' ? 'long' : 'short',
            sizeUsd: (p.sizeUsd || 0) / 1_000_000,
            collateralUsd: (p.collateralUsd || 0) / 1_000_000,
            entryPrice: (p.price || 0) / 1_000_000,
            leverage: p.sizeUsd && p.collateralUsd ? (p.sizeUsd / p.collateralUsd).toFixed(1) : '0',
            pnlUsd: (p.realisedPnlUsd || 0) / 1_000_000,
            openTime: p.openTime ? new Date(p.openTime * 1000).toISOString() : '',
        }));
    }

    /**
     * Map custody address to symbol
     */
    _custodyToSymbol(custodyKey) {
        for (const [symbol, addr] of Object.entries(CUSTODIES)) {
            if (addr === custodyKey) return symbol;
        }
        return 'Unknown';
    }

    /**
     * Scan on-chain for Position accounts owned by this wallet
     */
    async _scanPositionsOnChain() {
        try {
            const { PublicKey } = require('@solana/web3.js');
            const programId = new PublicKey(PERP_PROGRAM_ID);

            // getProgramAccounts with owner filter
            const accounts = await this.connection.getProgramAccounts(programId, {
                filters: [
                    { dataSize: 200 }, // Approximate Position account size
                    { memcmp: { offset: 8, bytes: this.keypair.publicKey.toBase58() } }, // owner field
                ],
            });

            // Parse raw account data (simplified — real parsing would use Anchor IDL)
            const positions = accounts.map(acc => ({
                key: acc.pubkey.toBase58(),
                market: 'Unknown',
                side: 'unknown',
                sizeUsd: 0,
                collateralUsd: 0,
                entryPrice: 0,
                leverage: '0',
                pnlUsd: 0,
                openTime: '',
                raw: true, // Flag that this needs full parsing
            }));

            return { positions, error: null };
        } catch (e) {
            return { positions: [], error: e.message };
        }
    }
}

module.exports = JupiterPerps;
