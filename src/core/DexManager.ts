import { PublicKey, Transaction, VersionedTransaction, Connection, Keypair } from '@solana/web3.js';

export interface SwapParams {
  srcPk: PublicKey;
  dstPk: PublicKey;
  amount: number;
  slippage: number;
  userKeypair: Keypair;
}

export interface SwapResult {
  success: boolean;
  txId?: string;
  error?: string;
  actualSlippage?: number;
  fees?: number;
  inputAmount: number;
  outputAmount?: number;
}

export interface QuoteResult {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fees: number;
  route?: any;
}

export abstract class DexClient {
  protected connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  abstract getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    slippage: number
  ): Promise<QuoteResult>;

  abstract swap(params: SwapParams): Promise<SwapResult>;
}

export class LetsBonkClient extends DexClient {
  private apiUrl: string;
  private tokenDecimals: Map<string, number> = new Map();

  constructor(connection: Connection, apiUrl: string) {
    super(connection);
    this.apiUrl = apiUrl;
  }

  private async getTokenDecimals(mint: PublicKey): Promise<number> {
    const mintStr = mint.toString();

    // Check cache first
    if (this.tokenDecimals.has(mintStr)) {
      return this.tokenDecimals.get(mintStr)!;
    }

    try {
      // Get mint info from blockchain
      const mintInfo = await this.connection.getParsedAccountInfo(mint);
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        const decimals = mintInfo.value.data.parsed.info.decimals;
        this.tokenDecimals.set(mintStr, decimals);
        return decimals;
      }
    } catch (error) {
      console.warn(`Failed to get decimals for ${mintStr}, defaulting to 9:`, error);
    }

    // Default to 9 decimals (SOL standard) if we can't get the info
    this.tokenDecimals.set(mintStr, 9);
    return 9;
  }

  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    slippage: number
  ): Promise<QuoteResult> {
    try {
      // Get proper decimals for both tokens
      const inputDecimals = await this.getTokenDecimals(inputMint);
      const outputDecimals = await this.getTokenDecimals(outputMint);

      const response = await fetch(`${this.apiUrl}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint: inputMint.toString(),
          outputMint: outputMint.toString(),
          amount: amount * Math.pow(10, inputDecimals),
          slippageBps: slippage * 100,
        }),
      });

      if (!response.ok) {
        throw new Error(`Let's Bonk API error: ${response.statusText}`);
      }

      const data = await response.json() as any;

      return {
        inputAmount: amount,
        outputAmount: data.outputAmount / Math.pow(10, outputDecimals),
        priceImpact: data.priceImpact,
        fees: data.fees / Math.pow(10, 9), // Fees are usually in SOL (9 decimals)
        route: data.route,
      };
    } catch (error) {
      throw new Error(`Let's Bonk quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async swap(params: SwapParams): Promise<SwapResult> {
    try {
      // Get quote first
      const quote = await this.getQuote(
        params.srcPk,
        params.dstPk,
        params.amount,
        params.slippage
      );

      // Get swap transaction
      const response = await fetch(`${this.apiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint: params.srcPk.toString(),
          outputMint: params.dstPk.toString(),
          amount: params.amount * Math.pow(10, await this.getTokenDecimals(params.srcPk)),
          slippageBps: params.slippage * 100,
          userPublicKey: params.userKeypair.publicKey.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Let's Bonk swap API error: ${response.statusText}`);
      }

      const { transaction } = await response.json() as any;

      // Deserialize and sign transaction (handle both legacy and versioned transactions)
      const txBuffer = Buffer.from(transaction, 'base64');
      let serializedTx: Buffer;

      try {
        // Try versioned transaction first
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        versionedTx.sign([params.userKeypair]);
        serializedTx = Buffer.from(versionedTx.serialize());
      } catch (versionedError) {
        // Fallback to legacy transaction
        const tx = Transaction.from(txBuffer);
        tx.sign(params.userKeypair);
        serializedTx = tx.serialize();
      }

      // Send transaction
      const txId = await this.connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(txId, 'confirmed');

      return {
        success: true,
        txId,
        actualSlippage: quote.priceImpact,
        fees: quote.fees,
        inputAmount: params.amount,
        outputAmount: quote.outputAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        inputAmount: params.amount,
      };
    }
  }


}

export class JupiterClient extends DexClient {
  private apiUrl: string;
  private rateLimit: number;
  private requestQueue: number[] = [];
  private readonly windowMs: number = 60000; // 1 minute window
  private static requestCount: number = 0;
  private tokenDecimals: Map<string, number> = new Map();

  constructor(connection: Connection, apiUrl: string, rateLimit: number = 1) {
    super(connection);
    this.apiUrl = apiUrl;
    this.rateLimit = rateLimit; // requests per second
  }

  private async getTokenDecimals(mint: PublicKey): Promise<number> {
    const mintStr = mint.toString();

    // Check cache first
    if (this.tokenDecimals.has(mintStr)) {
      return this.tokenDecimals.get(mintStr)!;
    }

    try {
      // Get mint info from blockchain
      const mintInfo = await this.connection.getParsedAccountInfo(mint);
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        const decimals = mintInfo.value.data.parsed.info.decimals;
        this.tokenDecimals.set(mintStr, decimals);
        console.log(`📊 Token ${mintStr.slice(0, 8)} has ${decimals} decimals`);
        return decimals;
      }
    } catch (error) {
      console.warn(`Failed to get decimals for ${mintStr}, defaulting to 9:`, error);
    }

    // Default to 9 decimals (SOL standard) if we can't get the info
    this.tokenDecimals.set(mintStr, 9);
    return 9;
  }

  private async rateLimitedRequest(url: string, options?: RequestInit): Promise<Response> {
    const now = Date.now();

    // Clean old requests from queue (older than 1 minute)
    this.requestQueue = this.requestQueue.filter(time => now - time < this.windowMs);

    // Calculate max requests per minute based on rate limit per second
    const maxRequestsPerMinute = this.rateLimit * 60;

    // If we're at the limit, wait until we can make another request
    if (this.requestQueue.length >= maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requestQueue);
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer

      if (waitTime > 0) {
        console.log(`⏳ Jupiter rate limit reached (${this.requestQueue.length}/${maxRequestsPerMinute} per minute), waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.rateLimitedRequest(url, options); // Recursive call to check again
      }
    }

    // Also ensure minimum interval between requests
    const minInterval = 1000 / this.rateLimit;
    const lastRequest = this.requestQueue.length > 0 ? Math.max(...this.requestQueue) : 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏳ Jupiter rate limit: waiting ${waitTime}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request
    this.requestQueue.push(Date.now());
    JupiterClient.requestCount++;
    console.log(`🔢 Jupiter request #${JupiterClient.requestCount}: ${url.split('?')[0]}`);
    return fetch(url, options);
  }

  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    slippage: number
  ): Promise<QuoteResult> {
    try {
      // Get decimals for both tokens
      const outputDecimals = await this.getTokenDecimals(outputMint);

      const url = `${this.apiUrl}/quote?` + new URLSearchParams({
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString(),
        amount: (amount * Math.pow(10, await this.getTokenDecimals(inputMint))).toString(),
        slippageBps: (slippage * 100).toString(),
      });

      const response = await this.rateLimitedRequest(url);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit, wait and retry once
          console.log('⚠️ Jupiter rate limit hit, waiting 2 seconds and retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));

          const retryResponse = await this.rateLimitedRequest(url);
          if (!retryResponse.ok) {
            throw new Error(`Jupiter API error after retry: ${retryResponse.statusText}`);
          }
          return this.parseQuoteResponse(await retryResponse.json(), amount, outputDecimals);
        }
        throw new Error(`Jupiter API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return this.parseQuoteResponse(data, amount, outputDecimals);
    } catch (error) {
      throw new Error(`Jupiter quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseQuoteResponse(data: any, amount: number, outputDecimals: number = 9): QuoteResult {
    return {
      inputAmount: amount,
      outputAmount: parseInt(data.outAmount) / Math.pow(10, outputDecimals),
      priceImpact: parseFloat(data.priceImpactPct || '0'),
      fees: 0, // Jupiter doesn't provide fee info in quote
      route: data,
    };
  }

  async swap(params: SwapParams): Promise<SwapResult> {
    try {
      // Get quote first
      const quote = await this.getQuote(
        params.srcPk,
        params.dstPk,
        params.amount,
        params.slippage
      );

      // Get swap transaction
      const response = await this.rateLimitedRequest(`${this.apiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote.route,
          userPublicKey: params.userKeypair.publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit, wait and retry once
          console.log('⚠️ Jupiter swap rate limit hit, waiting 2 seconds and retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));

          const retryResponse = await this.rateLimitedRequest(`${this.apiUrl}/swap`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quoteResponse: quote.route,
              userPublicKey: params.userKeypair.publicKey.toString(),
              wrapAndUnwrapSol: true,
            }),
          });

          if (!retryResponse.ok) {
            throw new Error(`Jupiter swap API error after retry: ${retryResponse.statusText}`);
          }

          const { swapTransaction } = await retryResponse.json() as any;
          return this.executeSwapTransaction(swapTransaction, params, quote);
        }
        throw new Error(`Jupiter swap API error: ${response.statusText}`);
      }

      const { swapTransaction } = await response.json() as any;
      return this.executeSwapTransaction(swapTransaction, params, quote);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        inputAmount: params.amount,
      };
    }
  }

  private async executeSwapTransaction(
    swapTransaction: string,
    params: SwapParams,
    quote: QuoteResult
  ): Promise<SwapResult> {
    // Deserialize and sign transaction (handle both legacy and versioned transactions)
    const txBuffer = Buffer.from(swapTransaction, 'base64');
    let serializedTx: Buffer;

    try {
      // Try versioned transaction first
      const versionedTx = VersionedTransaction.deserialize(txBuffer);
      versionedTx.sign([params.userKeypair]);
      serializedTx = Buffer.from(versionedTx.serialize());
    } catch (versionedError) {
      // Fallback to legacy transaction
      const tx = Transaction.from(txBuffer);
      tx.sign(params.userKeypair);
      serializedTx = tx.serialize();
    }

    // Send transaction
    const txId = await this.connection.sendRawTransaction(serializedTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await this.connection.confirmTransaction(txId, 'confirmed');

    return {
      success: true,
      txId,
      actualSlippage: quote.priceImpact,
      fees: quote.fees,
      inputAmount: params.amount,
      outputAmount: quote.outputAmount,
    };
  }


}

export class DexManager {
  private jupiterClient: DexClient;

  constructor(
    primaryClient: DexClient,
    fallbackClient: DexClient,
    liquidityThreshold: number
  ) {
    // Use Jupiter as the main client (fallbackClient is Jupiter)
    this.jupiterClient = fallbackClient;
    // Suppress unused parameter warnings
    void primaryClient;
    void liquidityThreshold;
  }

  async swap(params: SwapParams): Promise<SwapResult> {
    try {
      // Use Jupiter directly (skip liquidity checking)
      return await this.jupiterClient.swap(params);
    } catch (error) {
      return {
        success: false,
        error: `Jupiter swap failed: ${error instanceof Error ? error.message : String(error)}`,
        inputAmount: params.amount,
      };
    }
  }

  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    slippage: number
  ): Promise<QuoteResult> {
    // Use Jupiter directly for quotes
    return await this.jupiterClient.getQuote(inputMint, outputMint, amount, slippage);
  }
}
