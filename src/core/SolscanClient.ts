// Solscan API client for price fetching and balance checking

export interface TokenPrice {
  usd: number;
  sol: number;
  lastUpdated: number;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export interface WalletBalance {
  sol: number;
  tokens: TokenBalance[];
}

export class SolscanClient {
  private baseUrl: string;
  private priceCache: Map<string, { price: TokenPrice; expiry: number }> = new Map();
  private balanceCache: Map<string, { balance: WalletBalance; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 100; // 100ms between requests

  constructor(baseUrl: string = 'https://api.solscan.io') {
    this.baseUrl = baseUrl;
    console.log(`🌐 Using Solscan public API URL: ${baseUrl}`);
  }

  private async rateLimitedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
      console.log(`⏳ Solscan rate limit: waiting ${waitTime}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    console.log(`📊 Solscan request #${this.requestCount}: ${url}`);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async getTokenPrice(tokenMint: string): Promise<TokenPrice> {
    // Check cache first
    const cached = this.priceCache.get(tokenMint);
    if (cached && Date.now() < cached.expiry) {
      console.log(`💰 Using cached price for ${tokenMint.slice(0, 8)}: $${cached.price.usd}`);
      return cached.price;
    }

    try {
      const url = `${this.baseUrl}/token/meta?tokenAddress=${tokenMint}`;
      const response = await this.rateLimitedRequest(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Solscan API Error Details:`, {
          status: response.status,
          statusText: response.statusText,
          url: url,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`Solscan price API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;

      if (!data || !data.priceUsdt) {
        throw new Error(`Solscan price API returned no data for ${tokenMint}`);
      }

      // Get SOL price to calculate token price in SOL
      const solPrice = await this.getSolPrice();

      const price: TokenPrice = {
        usd: parseFloat(data.priceUsdt || '0'),
        sol: parseFloat(data.priceUsdt || '0') / solPrice.usd,
        lastUpdated: Date.now(),
      };

      // Cache the result
      this.priceCache.set(tokenMint, {
        price,
        expiry: Date.now() + this.CACHE_DURATION,
      });

      console.log(`💰 Fresh token price for ${tokenMint.slice(0, 8)}: $${price.usd} (${price.sol.toFixed(8)} SOL)`);
      return price;

    } catch (error) {
      console.error(`Failed to fetch token price from Solscan:`, error);
      
      // Return cached price if available, even if expired
      if (cached) {
        console.log(`⚠️ Using expired cached price for ${tokenMint.slice(0, 8)}`);
        return cached.price;
      }
      
      // Return zero price as fallback
      return {
        usd: 0,
        sol: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  private async getSolPrice(): Promise<TokenPrice> {
    const solMint = 'So11111111111111111111111111111111111111112';
    
    // Check cache first
    const cached = this.priceCache.get(solMint);
    if (cached && Date.now() < cached.expiry) {
      return cached.price;
    }

    try {
      const url = `${this.baseUrl}/token/meta?tokenAddress=${solMint}`;
      const response = await this.rateLimitedRequest(url);

      if (!response.ok) {
        throw new Error(`Solscan SOL price API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      const price: TokenPrice = {
        usd: parseFloat(data.priceUsdt || '150'), // Fallback to ~$150 if no data
        sol: 1, // SOL price in SOL is always 1
        lastUpdated: Date.now(),
      };

      // Cache the result
      this.priceCache.set(solMint, {
        price,
        expiry: Date.now() + this.CACHE_DURATION,
      });

      return price;

    } catch (error) {
      console.error(`Failed to fetch SOL price from Solscan:`, error);
      
      // Return fallback SOL price
      return {
        usd: 150, // Reasonable fallback
        sol: 1,
        lastUpdated: Date.now(),
      };
    }
  }

  async getWalletBalance(walletAddress: string): Promise<WalletBalance> {
    // Check cache first
    const cached = this.balanceCache.get(walletAddress);
    if (cached && Date.now() < cached.expiry) {
      return cached.balance;
    }

    try {
      const url = `${this.baseUrl}/account/token?address=${walletAddress}`;
      const response = await this.rateLimitedRequest(url);

      if (!response.ok) {
        throw new Error(`Solscan balance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (!data.success || !data.data) {
        throw new Error(`Solscan balance API returned no data for ${walletAddress}`);
      }

      // Get SOL balance
      const solBalanceUrl = `${this.baseUrl}/account?address=${walletAddress}`;
      const solResponse = await this.rateLimitedRequest(solBalanceUrl);
      let solBalance = 0;
      
      if (solResponse.ok) {
        const solData = await solResponse.json() as any;
        solBalance = parseFloat(solData.data?.lamports || '0') / 1e9; // Convert lamports to SOL
      }

      // Parse token balances
      const tokens: TokenBalance[] = data.data.map((token: any) => ({
        mint: token.tokenAddress,
        amount: parseFloat(token.amount || '0'),
        decimals: parseInt(token.decimals || '0'),
        uiAmount: parseFloat(token.amount || '0') / Math.pow(10, parseInt(token.decimals || '0')),
      }));

      const balance: WalletBalance = {
        sol: solBalance,
        tokens,
      };

      // Cache the result
      this.balanceCache.set(walletAddress, {
        balance,
        expiry: Date.now() + this.CACHE_DURATION,
      });

      return balance;

    } catch (error) {
      console.error(`Failed to fetch wallet balance from Solscan:`, error);
      
      // Return cached balance if available, even if expired
      if (cached) {
        console.log(`⚠️ Using expired cached balance for ${walletAddress.slice(0, 8)}`);
        return cached.balance;
      }
      
      // Return empty balance as fallback
      return {
        sol: 0,
        tokens: [],
      };
    }
  }

  // Calculate how many tokens to sell for a given SOL value
  async calculateTokensToSell(tokenMint: string, solValue: number): Promise<number> {
    try {
      const tokenPrice = await this.getTokenPrice(tokenMint);
      
      if (tokenPrice.sol <= 0) {
        console.warn(`⚠️ Token ${tokenMint.slice(0, 8)} has zero or invalid price, cannot calculate sell amount`);
        return 0;
      }

      const tokensToSell = solValue / tokenPrice.sol;
      console.log(`🧮 Calculation: ${solValue} SOL ÷ ${tokenPrice.sol.toFixed(8)} SOL/token = ${tokensToSell.toFixed(6)} tokens`);
      
      return tokensToSell;

    } catch (error) {
      console.error(`Failed to calculate tokens to sell:`, error);
      return 0;
    }
  }
}
