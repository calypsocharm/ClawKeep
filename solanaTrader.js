/**
 * solanaTrader.js — Autonomous Solana Trading Bot (Server-Side)
 * 
 * Handles: wallet gen/import, balance checks, Jupiter swaps,
 * price monitoring, stop-loss/take-profit rule evaluation,
 * technical indicators (ATR, RSI, EMA, AVWAP, VP), and strategy evaluation.
 * 
 * Requires: npm install @solana/web3.js bs58 bip39 ed25519-hd-key
 * (Jupiter API & GeckoTerminal API are REST — no extra SDK needed)
 */

const indicators = require('./indicators');
const JupiterPerps = require('./jupiterPerps');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Will be loaded lazily to avoid crashing if deps not installed
let Connection, Keypair, PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram;
let bs58Encode, bs58Decode;
let bip39, derivePath;

function loadSolanaDeps() {
    if (Connection) return true;
    try {
        const solanaWeb3 = require('@solana/web3.js');
        Connection = solanaWeb3.Connection;
        Keypair = solanaWeb3.Keypair;
        PublicKey = solanaWeb3.PublicKey;
        Transaction = solanaWeb3.Transaction;
        VersionedTransaction = solanaWeb3.VersionedTransaction;
        LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
        SystemProgram = solanaWeb3.SystemProgram;

        // bs58 v5 uses named exports, v4 uses default
        const bs58Mod = require('bs58');
        if (typeof bs58Mod.encode === 'function') {
            bs58Encode = bs58Mod.encode;
            bs58Decode = bs58Mod.decode;
        } else if (bs58Mod.default && typeof bs58Mod.default.encode === 'function') {
            bs58Encode = bs58Mod.default.encode;
            bs58Decode = bs58Mod.default.decode;
        } else {
            // Fallback: try using it directly (v4 style)
            bs58Encode = (buf) => bs58Mod.encode ? bs58Mod.encode(buf) : bs58Mod(buf);
            bs58Decode = (str) => bs58Mod.decode ? bs58Mod.decode(str) : bs58Mod(str);
        }

        return true;
    } catch (e) {
        console.error('[SolanaTrader] Missing deps — run: npm install @solana/web3.js bs58');
        return false;
    }
}

function loadBip39Deps() {
    if (bip39) return true;
    try {
        bip39 = require('bip39');
        const edHd = require('ed25519-hd-key');
        derivePath = edHd.derivePath;
        return true;
    } catch (e) {
        console.warn('[SolanaTrader] BIP39 deps not installed — run: npm install bip39 ed25519-hd-key');
        return false;
    }
}

// Token mint addresses (mainnet)
const TOKEN_MINTS = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const GECKO_API = 'https://api.geckoterminal.com/api/v2';

// Known pool addresses for common pairs (GeckoTerminal Solana)
const KNOWN_POOLS = {
    'SOL/USDC': 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE',
    'SOL/USDT': '5bghK4jSW3pKCoKYGSfgBR8bTVKuEgmfkEyJfo9aZMBj',
};



class SolanaTrader {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.walletPath = path.join(dataDir, 'burner_wallet.json');
        this.rulesPath = path.join(dataDir, 'trading_rules.json');
        this.logPath = path.join(dataDir, 'trade_log.json');
        this.strategiesPath = path.join(dataDir, 'strategies.json');
        this.positionsPath = path.join(dataDir, 'positions.json');

        this.keypair = null;
        this.connection = null;
        this.mnemonic = null; // BIP39 seed phrase
        this.rules = [];
        this.tradeLog = [];
        this.isRunning = false;
        this.monitorInterval = null;
        this.lastCheck = null;
        this.broadcastFn = null; // set by server.js to send WS messages

        // Phase 1: Indicator engine
        this.ohlcvCache = {};       // { 'SOL/USDC_day': { candles, fetchedAt } }
        this.poolCache = {};        // { tokenMint: poolAddress }
        this.strategies = [];       // saved strategy configs
        this.positions = [];        // active positions with entry tracking
        this.perps = null;          // JupiterPerps instance (lazy init)
        this.keepAlive = false;     // Keep bot running even when WS disconnects
        this.perpsAutoEnabled = false; // Allow autonomous perps trading
        this.indicatorConfig = {    // default indicator params
            atrPeriod: 14,
            rsiPeriod: 14,
            emaPeriods: [20, 50, 200],
            vpBins: 50,
            avwapMajorLookback: 400,
            avwapCurrentLookback: 63,
        };

        // Load saved state
        this._loadWallet();
        this._loadRules();
        this._loadLog();
        this._loadStrategies();
        this._loadPositions();
    }

    // --- Wallet Management ---

    _loadWallet() {
        try {
            if (fs.existsSync(this.walletPath)) {
                if (!loadSolanaDeps()) return;
                const data = JSON.parse(fs.readFileSync(this.walletPath, 'utf8'));
                this.keypair = Keypair.fromSecretKey(Uint8Array.from(data.secretKey));
                if (data.mnemonic) this.mnemonic = data.mnemonic;
                console.log(`[SolanaTrader] Loaded wallet: ${this.keypair.publicKey.toBase58()}`);
            }
        } catch (e) {
            console.error('[SolanaTrader] Failed to load wallet:', e.message);
        }
    }

    _saveWallet() {
        if (!this.keypair) return;
        const data = {
            secretKey: Array.from(this.keypair.secretKey),
            mnemonic: this.mnemonic || null,
        };
        fs.writeFileSync(this.walletPath, JSON.stringify(data));
    }

    generateWallet() {
        if (!loadSolanaDeps()) return { error: 'Solana dependencies not installed' };

        // Try BIP39 mnemonic generation if deps available
        if (loadBip39Deps()) {
            const mnemonic = bip39.generateMnemonic();
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
            this.keypair = Keypair.fromSeed(derived.key);
            this.mnemonic = mnemonic;
            this._saveWallet();
            console.log(`[SolanaTrader] Generated wallet (BIP39): ${this.keypair.publicKey.toBase58()}`);
            return { publicKey: this.keypair.publicKey.toBase58(), mnemonic };
        }

        // Fallback: generate without mnemonic
        this.keypair = Keypair.generate();
        this.mnemonic = null;
        this._saveWallet();
        console.log(`[SolanaTrader] Generated wallet: ${this.keypair.publicKey.toBase58()}`);
        return { publicKey: this.keypair.publicKey.toBase58() };
    }

    resetWallet() {
        this.stop(); // stop bot if running
        this.keypair = null;
        this.mnemonic = null;
        try { if (fs.existsSync(this.walletPath)) fs.unlinkSync(this.walletPath); } catch (e) { }
        console.log('[SolanaTrader] Wallet reset');
        return { ok: true };
    }

    importKey(keyInput) {
        if (!loadSolanaDeps()) return { error: 'Solana dependencies not installed' };
        try {
            const trimmed = keyInput.trim();

            // Check if input looks like a mnemonic (multiple words)
            if (trimmed.includes(' ') && trimmed.split(/\s+/).length >= 12) {
                if (!loadBip39Deps()) return { error: 'BIP39 deps not installed — run: npm install bip39 ed25519-hd-key' };
                if (!bip39.validateMnemonic(trimmed)) return { error: 'Invalid seed phrase' };

                const seed = bip39.mnemonicToSeedSync(trimmed);
                const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
                this.keypair = Keypair.fromSeed(derived.key);
                this.mnemonic = trimmed;
                this._saveWallet();
                console.log(`[SolanaTrader] Imported wallet from seed phrase: ${this.keypair.publicKey.toBase58()}`);
                return { publicKey: this.keypair.publicKey.toBase58() };
            }

            // Otherwise treat as base58 private key
            const decoded = bs58Decode(trimmed);
            this.keypair = Keypair.fromSecretKey(decoded);
            this.mnemonic = null;
            this._saveWallet();
            console.log(`[SolanaTrader] Imported wallet from private key: ${this.keypair.publicKey.toBase58()}`);
            return { publicKey: this.keypair.publicKey.toBase58() };
        } catch (e) {
            return { error: `Invalid key: ${e.message}` };
        }
    }

    exportKey() {
        if (!this.keypair || !loadSolanaDeps()) return { error: 'No wallet' };
        return {
            secretKey: bs58Encode(this.keypair.secretKey),
            mnemonic: this.mnemonic || null,
        };
    }

    _getConnection() {
        if (!this.connection) {
            if (!loadSolanaDeps()) return null;
            this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
        }
        return this.connection;
    }

    async getBalance() {
        if (!this.keypair) return 0;
        const conn = this._getConnection();
        if (!conn) return 0;
        try {
            const lamports = await conn.getBalance(this.keypair.publicKey);
            return lamports / LAMPORTS_PER_SOL;
        } catch (e) {
            console.error('[SolanaTrader] Balance error:', e.message);
            return 0;
        }
    }

    // Get USDC SPL token balance
    async getUsdcBalance() {
        if (!this.keypair) return 0;
        const conn = this._getConnection();
        if (!conn) return 0;
        try {
            const usdcMint = new PublicKey(TOKEN_MINTS['USDC']);
            const tokenAccounts = await conn.getTokenAccountsByOwner(
                this.keypair.publicKey,
                { mint: usdcMint }
            );
            if (tokenAccounts.value.length === 0) return 0;
            // Parse token amount from account data (offset 64, 8 bytes LE)
            const accountData = tokenAccounts.value[0].account.data;
            const amount = accountData.readBigUInt64LE(64);
            // USDC has 6 decimals
            return Number(amount) / 1e6;
        } catch (e) {
            console.error('[SolanaTrader] USDC balance error:', e.message);
            return 0;
        }
    }

    // Get current SOL price in USD via Jupiter Price API
    async getSolPrice() {
        try {
            const resp = await fetch(`${JUPITER_PRICE_API}?ids=${TOKEN_MINTS['SOL']}`);
            if (!resp.ok) return 0;
            const json = await resp.json();
            const price = json.data?.[TOKEN_MINTS['SOL']]?.price;
            return price ? parseFloat(price) : 0;
        } catch (e) {
            console.error('[SolanaTrader] SOL price error:', e.message);
            return 0;
        }
    }

    // --- Rules Management ---

    _loadRules() {
        try {
            if (fs.existsSync(this.rulesPath)) {
                this.rules = JSON.parse(fs.readFileSync(this.rulesPath, 'utf8'));
            }
        } catch (e) {
            this.rules = [];
        }
    }

    _saveRules() {
        fs.writeFileSync(this.rulesPath, JSON.stringify(this.rules, null, 2));
    }

    addRule(rule) {
        const newRule = {
            id: crypto.randomUUID(),
            token: rule.token || 'SOL',
            type: rule.type || 'stop-loss',
            triggerPrice: rule.triggerPrice || 0,
            action: rule.action || 'sell-all',
            outputToken: rule.outputToken || 'USDC',
            active: true,
            createdAt: new Date().toISOString(),
        };
        this.rules.push(newRule);
        this._saveRules();
        return newRule;
    }

    removeRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        this._saveRules();
        return ruleId;
    }

    toggleRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.active = !rule.active;
            this._saveRules();
        }
        return ruleId;
    }

    // --- Trade Log ---

    _loadLog() {
        try {
            if (fs.existsSync(this.logPath)) {
                this.tradeLog = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
            }
        } catch (e) {
            this.tradeLog = [];
        }
    }

    _saveLog() {
        // Keep last 200 entries
        this.tradeLog = this.tradeLog.slice(0, 200);
        fs.writeFileSync(this.logPath, JSON.stringify(this.tradeLog, null, 2));
    }

    _log(entry) {
        const logEntry = {
            id: crypto.randomUUID(),
            ...entry,
            timestamp: new Date().toISOString(),
        };
        this.tradeLog.unshift(logEntry);
        this._saveLog();

        // Broadcast to frontend
        if (this.broadcastFn) {
            this.broadcastFn({ type: 'TRADER_LOG', entry: logEntry });
        }
        return logEntry;
    }

    // --- Jupiter Swap ---

    async getPrice(tokenSymbol) {
        const mint = TOKEN_MINTS[tokenSymbol];
        if (!mint) return null;
        try {
            const res = await fetch(`${JUPITER_PRICE_API}?ids=${mint}`);
            const data = await res.json();
            return data.data?.[mint]?.price ? parseFloat(data.data[mint].price) : null;
        } catch (e) {
            console.error(`[SolanaTrader] Price fetch error for ${tokenSymbol}:`, e.message);
            return null;
        }
    }

    async swap(inputMint, outputMint, amountLamports, slippageBps = 50) {
        if (!this.keypair) return { error: 'No wallet configured' };
        if (!loadSolanaDeps()) return { error: 'Solana deps not installed' };

        try {
            // 1. Get quote from Jupiter
            const quoteUrl = `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`;
            const quoteRes = await fetch(quoteUrl);
            const quoteData = await quoteRes.json();

            if (quoteData.error) return { error: `Jupiter quote error: ${quoteData.error}` };

            // 2. Get swap transaction
            const swapRes = await fetch(`${JUPITER_API}/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: quoteData,
                    userPublicKey: this.keypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true,
                }),
            });
            const swapData = await swapRes.json();

            if (swapData.error) return { error: `Jupiter swap error: ${swapData.error}` };

            // 3. Deserialize and sign
            const swapTxBuf = Buffer.from(swapData.swapTransaction, 'base64');
            const tx = VersionedTransaction.deserialize(swapTxBuf);
            tx.sign([this.keypair]);

            // 4. Send transaction
            const conn = this._getConnection();
            const rawTx = tx.serialize();
            const signature = await conn.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 2 });

            // 5. Confirm
            const latestBlockhash = await conn.getLatestBlockhash();
            await conn.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

            const inAmount = quoteData.inAmount;
            const outAmount = quoteData.outAmount;

            this._log({
                type: 'trade',
                message: `Swap ${inAmount} → ${outAmount}`,
                txHash: signature,
                inSymbol: inputMint,
                outSymbol: outputMint,
                inAmount: inAmount,
                outAmount: outAmount,
            });

            return { signature, inAmount, outAmount, inSymbol: inputMint, outSymbol: outputMint };
        } catch (e) {
            const errMsg = `Swap failed: ${e.message}`;
            this._log({ type: 'error', message: errMsg });
            return { error: errMsg };
        }
    }

    async manualSwap(inputSymbol, outputSymbol, amount, slippageBps) {
        const inputMint = TOKEN_MINTS[inputSymbol] || inputSymbol;
        const outputMint = TOKEN_MINTS[outputSymbol] || outputSymbol;

        // Convert amount to smallest unit
        let amountLamports;
        if (inputSymbol === 'SOL') {
            amountLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        } else {
            // For USDC/USDT (6 decimals)
            amountLamports = Math.floor(parseFloat(amount) * 1_000_000);
        }

        return this.swap(inputMint, outputMint, amountLamports, slippageBps || 50);
    }

    // --- Withdraw ---

    async withdraw(destination, amountSOL) {
        if (!this.keypair) return { error: 'No wallet' };
        if (!loadSolanaDeps()) return { error: 'Solana deps not installed' };

        try {
            const conn = this._getConnection();
            const destPubkey = new PublicKey(destination);
            const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: this.keypair.publicKey,
                    toPubkey: destPubkey,
                    lamports,
                })
            );

            tx.feePayer = this.keypair.publicKey;
            tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
            tx.sign(this.keypair);

            const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
            await conn.confirmTransaction(signature, 'confirmed');

            this._log({
                type: 'withdraw',
                message: `Withdrew ${amountSOL} SOL to ${destination.slice(0, 8)}...`,
                txHash: signature,
            });

            return { signature };
        } catch (e) {
            const errMsg = `Withdraw failed: ${e.message}`;
            this._log({ type: 'error', message: errMsg });
            return { error: errMsg };
        }
    }

    // --- Price Monitor & Rule Engine ---

    async start(intervalMs = 30000) {
        if (this.isRunning) return;
        if (!this.keypair) {
            this._log({ type: 'error', message: 'Cannot start: no wallet configured' });
            return;
        }

        this.isRunning = true;
        this._log({ type: 'system', message: `Bot started — monitoring every ${intervalMs / 1000}s` });

        const check = async () => {
            try {
                this.lastCheck = new Date().toISOString();
                const activeRules = this.rules.filter(r => r.active);

                // ── Spot Rules Evaluation ────────────────────────
                if (activeRules.length > 0) {
                    const tokens = [...new Set(activeRules.map(r => r.token))];

                    for (const tokenSymbol of tokens) {
                        const price = await this.getPrice(tokenSymbol);
                        if (price === null) continue;

                        for (const rule of activeRules.filter(r => r.token === tokenSymbol)) {
                            let triggered = false;

                            if (rule.type === 'stop-loss' && price <= rule.triggerPrice) {
                                triggered = true;
                            } else if (rule.type === 'take-profit' && price >= rule.triggerPrice) {
                                triggered = true;
                            }

                            if (triggered) {
                                this._log({
                                    type: 'rule_trigger',
                                    message: `${rule.type.toUpperCase()} triggered: ${tokenSymbol} @ $${price} (trigger: $${rule.triggerPrice})`,
                                });

                                const inputMint = TOKEN_MINTS[rule.token];
                                const outputMint = TOKEN_MINTS[rule.outputToken];
                                if (!inputMint || !outputMint) continue;

                                let amount;
                                if (rule.token === 'SOL') {
                                    const bal = await this.getBalance();
                                    amount = rule.action === 'sell-all' ? bal * 0.98 : bal * 0.5;
                                    amount = Math.floor(amount * LAMPORTS_PER_SOL);
                                } else {
                                    amount = 0;
                                }

                                if (amount > 0) {
                                    const result = await this.swap(inputMint, outputMint, amount);
                                    if (result.error) {
                                        this._log({ type: 'error', message: `Auto-swap failed: ${result.error}` });
                                    } else {
                                        rule.active = false;
                                        this._saveRules();

                                        if (this.broadcastFn) {
                                            this.broadcastFn({
                                                type: 'TRADER_SWAP_RESULT',
                                                ...result,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // ── Autonomous Perps Management ──────────────────
                if (this.perpsAutoEnabled) {
                    try {
                        await this._autoManagePerps();
                    } catch (perpsErr) {
                        console.error('[SolanaTrader] Auto-perps error:', perpsErr.message);
                    }
                }

            } catch (e) {
                console.error('[SolanaTrader] Monitor error:', e.message);
            }
        };

        // First check immediately
        await check();

        // Then on interval
        this.monitorInterval = setInterval(check, intervalMs);
    }

    // ── Autonomous Perps Management ─────────────────────────
    // Called each bot loop when perpsAutoEnabled is true.
    // Manages existing positions (TP/SL) and evaluates strategies for new entries.
    async _autoManagePerps() {
        const perps = this._initPerps();
        if (!perps) return;

        // 1. Monitor existing positions for TP/SL
        const { positions } = await perps.getPositions();
        if (positions && positions.length > 0) {
            for (const pos of positions) {
                const pnlPct = pos.collateralUsd > 0 ? (pos.pnlUsd / pos.collateralUsd) * 100 : 0;
                const takeProfitPct = 20;  // Close at +20% ROI
                const stopLossPct = -15;   // Close at -15% ROI

                if (pnlPct >= takeProfitPct) {
                    this._log({
                        type: 'perp_close',
                        message: `🎯 Auto TP: ${pos.side.toUpperCase()} ${pos.market}-PERP at +${pnlPct.toFixed(1)}% ROI ($${pos.pnlUsd.toFixed(2)} profit)`,
                    });
                    const result = await perps.closePosition(pos.key);
                    if (!result.error && this.broadcastFn) {
                        this.broadcastFn({ type: 'TRADER_PERP_CLOSED', signature: result.signature });
                    }
                } else if (pnlPct <= stopLossPct) {
                    this._log({
                        type: 'perp_close',
                        message: `🛑 Auto SL: ${pos.side.toUpperCase()} ${pos.market}-PERP at ${pnlPct.toFixed(1)}% ROI ($${pos.pnlUsd.toFixed(2)} loss)`,
                    });
                    const result = await perps.closePosition(pos.key);
                    if (!result.error && this.broadcastFn) {
                        this.broadcastFn({ type: 'TRADER_PERP_CLOSED', signature: result.signature });
                    }
                }
            }
        }

        // 2. Evaluate strategies for new perps entries (only if < 3 open positions)
        const openPositionCount = positions ? positions.length : 0;
        if (openPositionCount >= 3) return; // Max 3 concurrent positions

        const perpsStrategies = this.strategies.filter(s => s.autoPerps || s.name?.toLowerCase().includes('perp'));
        if (perpsStrategies.length === 0 && this.strategies.length > 0) {
            // If no perps-specific strategies, use the first available strategy 
            // but only on larger timeframes to avoid noise
            const fallback = this.strategies[0];
            if (fallback) perpsStrategies.push(fallback);
        }

        for (const strategy of perpsStrategies.slice(0, 1)) { // Evaluate at most 1 strategy per cycle
            try {
                const evalResult = await this.evaluateStrategy(strategy.name, 'SOL/USDC');
                if (!evalResult || evalResult.error) continue;

                const { entrySignal, exitSignal, thinking } = evalResult;

                if (entrySignal && entrySignal !== 'none') {
                    const side = entrySignal === 'long' ? 'long' : 'short';
                    const balance = await this.getBalance();
                    const solPrice = await this.getSolPrice();
                    const balanceUsd = balance * solPrice;

                    // Conservative: use 5% of balance as collateral, 3× leverage
                    const collateralUsd = Math.min(balanceUsd * 0.05, 50); // Max $50 auto-entry
                    const autoLeverage = 3;

                    if (collateralUsd >= 5) { // Min $5 collateral
                        this._log({
                            type: 'perp_open',
                            message: `🤖 Auto-entry: ${side.toUpperCase()} SOL-PERP | $${collateralUsd.toFixed(2)} × ${autoLeverage}x = $${(collateralUsd * autoLeverage).toFixed(2)} | Strategy: ${strategy.name}`,
                        });

                        const result = await this.openPerp('SOL', side, collateralUsd, autoLeverage, 'SOL');
                        if (!result.error && this.broadcastFn) {
                            this.broadcastFn({ type: 'TRADER_PERP_OPENED', ...result });
                        }
                    }
                }
            } catch (stratErr) {
                console.error('[SolanaTrader] Strategy eval error:', stratErr.message);
            }
        }
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this._log({ type: 'system', message: 'Bot stopped' });
    }

    // Full status for frontend
    async getStatus() {
        const solBalance = this.keypair ? await this.getBalance() : 0;
        const [usdcBalance, solPrice] = this.keypair
            ? await Promise.all([this.getUsdcBalance(), this.getSolPrice()])
            : [0, 0];
        return {
            type: 'TRADER_STATUS',
            walletCreated: !!this.keypair,
            publicKey: this.keypair ? this.keypair.publicKey.toBase58() : '',
            balance: solBalance,
            usdcBalance,
            solPrice,
            totalUsd: (solBalance * solPrice) + usdcBalance,
            isRunning: this.isRunning,
            rules: this.rules,
            recentTrades: this.tradeLog.slice(0, 30),
            lastCheck: this.lastCheck,
            hasStrategies: this.strategies.length > 0,
            positionCount: this.positions.length,
            keepAlive: this.keepAlive,
            perpsAutoEnabled: this.perpsAutoEnabled,
        };
    }

    // ─────────────────────────────────────────────────────────
    //  Jupiter Perps (Long/Short with Leverage)
    // ─────────────────────────────────────────────────────────

    _initPerps() {
        if (!this.perps && this.keypair) {
            if (!loadSolanaDeps()) return null;
            const conn = this._getConnection();
            this.perps = new JupiterPerps(conn, this.keypair);
        }
        return this.perps;
    }

    async openPerp(market, side, collateralUsd, leverage, collateralToken = 'SOL') {
        const perps = this._initPerps();
        if (!perps) return { error: 'Wallet not configured or deps missing' };

        const result = await perps.openPosition(market, side, collateralUsd, leverage, collateralToken);
        if (!result.error) {
            this._log({
                type: 'perp_open',
                message: `Opened ${side.toUpperCase()} ${market}-PERP: $${collateralUsd} × ${leverage}x = $${(collateralUsd * leverage).toFixed(2)} size`,
                txHash: result.signature,
            });
        } else {
            this._log({ type: 'error', message: `Perp open failed: ${result.error}` });
        }
        return result;
    }

    async closePerp(positionKey) {
        const perps = this._initPerps();
        if (!perps) return { error: 'Wallet not configured or deps missing' };

        const result = await perps.closePosition(positionKey);
        if (!result.error) {
            this._log({ type: 'perp_close', message: `Closed perp position`, txHash: result.signature });
        } else {
            this._log({ type: 'error', message: `Perp close failed: ${result.error}` });
        }
        return result;
    }

    async getPerps() {
        const perps = this._initPerps();
        if (!perps) return { positions: [], error: 'Wallet not configured' };
        return await perps.getPositions();
    }

    async getPerpsMarkets() {
        const perps = this._initPerps();
        if (!perps) return { markets: [], error: 'Wallet not configured' };
        return await perps.getMarkets();
    }

    // ─────────────────────────────────────────────────────────
    //  OHLCV Data Feed (GeckoTerminal — free, no API key)
    // ─────────────────────────────────────────────────────────

    /**
     * Find the top liquidity pool address for a token mint on Solana
     * @param {string} tokenMint - Solana token mint address
     * @returns {Promise<string|null>} pool address
     */
    async findPoolAddress(tokenMint) {
        if (this.poolCache[tokenMint]) return this.poolCache[tokenMint];

        try {
            const url = `${GECKO_API}/networks/solana/tokens/${tokenMint}/pools?page=1`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`GeckoTerminal pool search failed: ${resp.status}`);
            const json = await resp.json();

            if (json.data && json.data.length > 0) {
                // Pick the pool with the highest reserve (most liquid)
                const pool = json.data[0];
                const addr = pool.attributes.address;
                this.poolCache[tokenMint] = addr;
                console.log(`[SolanaTrader] Found pool for ${tokenMint}: ${addr} (${pool.attributes.name})`);
                return addr;
            }
            return null;
        } catch (e) {
            console.error(`[SolanaTrader] Pool discovery error:`, e.message);
            return null;
        }
    }

    /**
     * Fetch OHLCV candle data from GeckoTerminal
     * @param {string} poolAddress - Solana pool address
     * @param {string} timeframe - 'day', 'hour', 'minute'
     * @param {number} limit - number of candles (max 1000)
     * @returns {Promise<Array>} candles as [{ t, o, h, l, c, v }, ...]
     */
    async fetchOHLCV(poolAddress, timeframe = 'day', limit = 200) {
        const cacheKey = `${poolAddress}_${timeframe}`;
        const cached = this.ohlcvCache[cacheKey];
        const now = Date.now();
        // Cache: 5 min for day, 1 min for hour/minute
        const ttl = timeframe === 'day' ? 300000 : 60000;
        if (cached && (now - cached.fetchedAt) < ttl) {
            return cached.candles;
        }

        try {
            const url = `${GECKO_API}/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`OHLCV fetch failed: ${resp.status}`);
            const json = await resp.json();

            const raw = json.data?.attributes?.ohlcv_list || [];
            // API returns newest first, we want oldest first
            const candles = raw.reverse().map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));

            this.ohlcvCache[cacheKey] = { candles, fetchedAt: now };
            console.log(`[SolanaTrader] Fetched ${candles.length} ${timeframe} candles for pool ${poolAddress.slice(0, 8)}...`);
            return candles;
        } catch (e) {
            console.error(`[SolanaTrader] OHLCV fetch error:`, e.message);
            return cached ? cached.candles : [];
        }
    }

    /**
     * Get raw OHLCV candle data for charting
     * @param {string} pair - e.g. 'SOL/USDC'
     * @param {string} timeframe - 'day', 'hour', 'minute'
     * @param {number} limit - number of candles
     * @returns {Promise<Object>} { candles: [...], pair, timeframe }
     */
    async getCandles(pair = 'SOL/USDC', timeframe = 'day', limit = 300) {
        try {
            let poolAddress = KNOWN_POOLS[pair];
            if (!poolAddress) {
                const mint = TOKEN_MINTS[pair] || pair;
                poolAddress = await this.findPoolAddress(mint);
            }
            if (!poolAddress) return { error: `No pool found for ${pair}` };

            const candles = await this.fetchOHLCV(poolAddress, timeframe, limit);
            return { candles, pair, timeframe, candleCount: candles.length };
        } catch (e) {
            console.error(`[SolanaTrader] getCandles error:`, e.message);
            return { error: e.message };
        }
    }

    /**
     * Get computed indicators for a token pair
     * @param {string} pair - e.g. 'SOL/USDC' or a pool address
     * @param {string} timeframe - 'day', 'hour', 'minute'
     * @returns {Promise<Object>} computed indicators
     */
    async getIndicators(pair = 'SOL/USDC', timeframe = 'day') {
        try {
            // Resolve pool address
            let poolAddress = KNOWN_POOLS[pair];
            if (!poolAddress) {
                // Try as token mint → find pool
                const mint = TOKEN_MINTS[pair] || pair;
                poolAddress = await this.findPoolAddress(mint);
            }
            if (!poolAddress) return { error: `No pool found for ${pair}` };

            const candles = await this.fetchOHLCV(poolAddress, timeframe, 500);
            if (candles.length < 15) return { error: `Insufficient data: only ${candles.length} candles` };

            const result = indicators.computeAll(candles, this.indicatorConfig);
            result.pair = pair;
            result.timeframe = timeframe;
            result.candleCount = candles.length;
            return result;
        } catch (e) {
            console.error(`[SolanaTrader] getIndicators error:`, e.message);
            return { error: e.message };
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Strategy Config Management
    // ─────────────────────────────────────────────────────────

    _loadStrategies() {
        try {
            if (fs.existsSync(this.strategiesPath)) {
                this.strategies = JSON.parse(fs.readFileSync(this.strategiesPath, 'utf8'));
            }
        } catch (e) { this.strategies = []; }
    }

    _saveStrategies() {
        try {
            fs.writeFileSync(this.strategiesPath, JSON.stringify(this.strategies, null, 2));
        } catch (e) {
            console.error('[SolanaTrader] Failed to save strategies:', e.message);
        }
    }

    saveStrategy(strategy) {
        if (!strategy.name) return { error: 'Strategy needs a name' };
        // Upsert by name
        const idx = this.strategies.findIndex(s => s.name === strategy.name);
        if (idx >= 0) {
            this.strategies[idx] = { ...this.strategies[idx], ...strategy, updatedAt: Date.now() };
        } else {
            this.strategies.push({ ...strategy, createdAt: Date.now(), updatedAt: Date.now() });
        }
        this._saveStrategies();
        console.log(`[SolanaTrader] Strategy saved: ${strategy.name}`);
        return { ok: true, strategies: this.strategies };
    }

    deleteStrategy(name) {
        this.strategies = this.strategies.filter(s => s.name !== name);
        this._saveStrategies();
        return { ok: true, strategies: this.strategies };
    }

    getStrategies() {
        return { strategies: this.strategies };
    }

    // ─────────────────────────────────────────────────────────
    //  Position Tracking
    // ─────────────────────────────────────────────────────────

    _loadPositions() {
        try {
            if (fs.existsSync(this.positionsPath)) {
                this.positions = JSON.parse(fs.readFileSync(this.positionsPath, 'utf8'));
            }
        } catch (e) { this.positions = []; }
    }

    _savePositions() {
        try {
            fs.writeFileSync(this.positionsPath, JSON.stringify(this.positions, null, 2));
        } catch (e) {
            console.error('[SolanaTrader] Failed to save positions:', e.message);
        }
    }

    openPosition(pair, entryPrice, size, strategyName = '') {
        const pos = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            pair,
            entryPrice,
            avgPrice: entryPrice,
            size,
            adds: [],
            entryDate: Date.now(),
            strategyName,
            status: 'open',
            pnl: 0,
        };
        this.positions.push(pos);
        this._savePositions();
        this._log({ type: 'position_open', pair, entryPrice, size, strategyName });
        return pos;
    }

    addToPosition(posId, price, size) {
        const pos = this.positions.find(p => p.id === posId && p.status === 'open');
        if (!pos) return { error: 'Position not found' };

        const totalCost = pos.avgPrice * pos.size + price * size;
        pos.size += size;
        pos.avgPrice = totalCost / pos.size;
        pos.adds.push({ price, size, date: Date.now() });
        this._savePositions();
        this._log({ type: 'position_add', posId, price, size });
        return pos;
    }

    closePosition(posId, exitPrice, reason = '') {
        const pos = this.positions.find(p => p.id === posId && p.status === 'open');
        if (!pos) return { error: 'Position not found' };

        pos.exitPrice = exitPrice;
        pos.exitDate = Date.now();
        pos.pnl = ((exitPrice - pos.avgPrice) / pos.avgPrice) * 100;
        pos.holdDays = Math.floor((pos.exitDate - pos.entryDate) / 86400000);
        pos.reason = reason;
        pos.status = 'closed';
        this._savePositions();
        this._log({ type: 'position_close', posId, exitPrice, pnl: pos.pnl, holdDays: pos.holdDays, reason });
        return pos;
    }

    getPositions(status = 'all') {
        if (status === 'all') return this.positions;
        return this.positions.filter(p => p.status === status);
    }

    /**
 * Evaluate strategy conditions against current indicators
 * Returns signals (entry/exit) + detailed rule-by-rule thinking
 */
    async evaluateStrategy(strategyName, pair = 'SOL/USDC') {
        const strategy = this.strategies.find(s => s.name === strategyName);
        if (!strategy) return { error: `Strategy '${strategyName}' not found` };

        const ind = await this.getIndicators(pair, 'day');
        if (ind.error) return { error: ind.error };

        const signals = [];
        const ruleResults = []; // Detailed thinking log

        // Evaluate entry rules
        if (strategy.entryRules) {
            let allEntryMet = true;
            for (const rule of strategy.entryRules) {
                const met = this._evaluateRule(rule, ind);
                const detail = this._describeRule(rule, ind, met);
                ruleResults.push({ ...detail, side: 'entry', passed: met });
                if (!met) allEntryMet = false;
            }
            if (allEntryMet) {
                signals.push({ type: 'entry', message: `All entry conditions met for ${strategy.name}`, pair });
            }
        }

        // Evaluate exit rules against open positions
        const openPositions = this.positions.filter(p => p.pair === pair && p.status === 'open');
        for (const pos of openPositions) {
            const holdDays = Math.floor((Date.now() - pos.entryDate) / 86400000);
            if (strategy.exitRules) {
                for (const rule of strategy.exitRules) {
                    if (rule.type === 'hard_stop') {
                        const stopPrice = pos.entryPrice - (rule.atrMultiplier || 1.2) * ind.atr.current;
                        const hit = ind.price <= stopPrice;
                        ruleResults.push({
                            side: 'exit', label: '🛑 Hard Stop', passed: !hit,
                            detail: `Stop @ $${stopPrice.toFixed(2)} (entry $${pos.entryPrice.toFixed(2)} - ${rule.atrMultiplier}×ATR)`,
                            current: `Price: $${ind.price.toFixed(2)}`
                        });
                        if (hit) signals.push({ type: 'exit_stop', posId: pos.id, message: `Hard stop hit ($${ind.price.toFixed(2)} <= $${stopPrice.toFixed(2)})`, urgent: true });
                    }
                    if (rule.type === 'profit_target') {
                        const minHold = rule.minHoldDays || 0;
                        const targetPct = rule.percent || 20;
                        const targetPrice = pos.avgPrice * (1 + targetPct / 100);
                        const holdOk = holdDays >= minHold;
                        const priceOk = ind.price >= targetPrice;
                        ruleResults.push({
                            side: 'exit', label: '🎯 Profit Target', passed: holdOk && priceOk,
                            detail: `Target $${targetPrice.toFixed(2)} (+${targetPct}%), min hold ${minHold}d`,
                            current: `Hold: ${holdDays}d, Price: $${ind.price.toFixed(2)}`
                        });
                        if (holdOk && priceOk) signals.push({ type: 'exit_profit', posId: pos.id, message: `+${targetPct}% target reached after ${holdDays} days` });
                    }
                    if (rule.type === 'emergency') {
                        const hit = ind.atr.abnormal && ind.price < ind.vp.poc;
                        ruleResults.push({
                            side: 'exit', label: '⚠️ Emergency', passed: !hit,
                            detail: `ATR abnormal + price below POC ($${ind.vp.poc.toFixed(2)})`,
                            current: `ATR abnormal: ${ind.atr.abnormal}, Price vs POC: ${ind.price > ind.vp.poc ? 'above' : 'BELOW'}`
                        });
                        if (hit) signals.push({ type: 'exit_emergency', posId: pos.id, message: 'Abnormal ATR + below POC — emergency exit', urgent: true });
                    }
                }
            }
        }

        return { signals, ruleResults, indicators: ind, openPositions: openPositions.length, strategyName };
    }
    /**
     * Evaluate a single rule condition against indicators
     */
    _evaluateRule(rule, ind) {
        try {
            switch (rule.indicator) {
                case 'rsi':
                    return this._compare(ind.rsi.current, rule.condition, rule.value);
                case 'stage':
                case 'ladder_stage':
                    return this._compare(ind.ladder.stage, rule.condition, rule.value);
                case 'price_vs_val':
                    return Math.abs(ind.priceRelative.vsVAL) <= (rule.threshold || 0.02);
                case 'price_vs_poc':
                    return Math.abs(ind.priceRelative.vsPOC) <= (rule.threshold || 0.02);
                case 'price_above_avwap_major':
                    return ind.price > ind.avwap.major.current;
                case 'price_above_avwap_current':
                    return ind.price > ind.avwap.current.current;
                case 'price_above_vah':
                    return ind.price > ind.vp.vah;
                case 'price_above_poc':
                    return ind.price > ind.vp.poc;
                case 'diamond':
                    if (rule.color) return ind.diamond.hasDiamond && ind.diamond.color === rule.color;
                    return ind.diamond.hasDiamond;
                case 'atr_abnormal':
                    return ind.atr.abnormal === (rule.value !== false);
                default:
                    return true;
            }
        } catch (e) {
            return false;
        }
    }

    /**
     * Describe a rule evaluation in human-readable form for the "Bot Brain" view
     */
    _describeRule(rule, ind, passed) {
        try {
            switch (rule.indicator) {
                case 'rsi':
                    return { label: `RSI ${rule.condition || '<'} ${rule.value}`, detail: `RSI must be ${rule.condition || '<'} ${rule.value}`, current: `Current: ${ind.rsi.current.toFixed(1)} (${ind.rsi.zone})` };
                case 'stage': case 'ladder_stage':
                    return { label: `Stage ${rule.condition || '>='} ${rule.value}`, detail: `Ladder stage must be ${rule.condition || '>='} ${rule.value}`, current: `Current: Stage ${ind.ladder.stage}` };
                case 'price_vs_val':
                    return { label: 'Price near VAL', detail: `Within ${((rule.threshold || 0.02) * 100).toFixed(1)}% of VAL ($${ind.vp.val.toFixed(2)})`, current: `Distance: ${(Math.abs(ind.priceRelative.vsVAL) * 100).toFixed(1)}%` };
                case 'price_vs_poc':
                    return { label: 'Price near POC', detail: `Within ${((rule.threshold || 0.02) * 100).toFixed(1)}% of POC ($${ind.vp.poc.toFixed(2)})`, current: `Distance: ${(Math.abs(ind.priceRelative.vsPOC) * 100).toFixed(1)}%` };
                case 'price_above_avwap_major':
                    return { label: 'Above Major AVWAP', detail: `Price > Major AVWAP ($${ind.avwap.major.current.toFixed(2)})`, current: `Price: $${ind.price.toFixed(2)}` };
                case 'price_above_avwap_current':
                    return { label: 'Above Current AVWAP', detail: `Price > Current AVWAP ($${ind.avwap.current.current.toFixed(2)})`, current: `Price: $${ind.price.toFixed(2)}` };
                case 'price_above_vah':
                    return { label: 'Above VAH', detail: `Price > VAH ($${ind.vp.vah.toFixed(2)})`, current: `Price: $${ind.price.toFixed(2)}` };
                case 'price_above_poc':
                    return { label: 'Above POC', detail: `Price > POC ($${ind.vp.poc.toFixed(2)})`, current: `Price: $${ind.price.toFixed(2)}` };
                case 'diamond':
                    return { label: `Diamond (${rule.color || 'any'})`, detail: `Diamond pattern ${rule.color ? rule.color + ' ' : ''}detected`, current: ind.diamond.hasDiamond ? `${ind.diamond.color} diamond found` : 'No diamond' };
                case 'atr_abnormal':
                    return { label: 'ATR Abnormal', detail: 'Abnormal volatility detected', current: `ATR abnormal: ${ind.atr.abnormal}` };
                default:
                    return { label: rule.label || rule.indicator, detail: 'Custom rule', current: '' };
            }
        } catch (e) {
            return { label: rule.label || rule.indicator, detail: 'Error reading', current: '' };
        }
    }

    _compare(actual, condition, value) {
        switch (condition) {
            case '>': return actual > value;
            case '>=': return actual >= value;
            case '<': return actual < value;
            case '<=': return actual <= value;
            case '==': return actual == value;
            case '!=': return actual != value;
            default: return false;
        }
    }
}

module.exports = SolanaTrader;
