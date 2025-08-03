/**
 * Core algorithm for splitting trade amounts across wallets
 * As specified in the technical specification section 6
 */

export interface WalletWeight {
  publicKey: string;
  weight: number;
  minTradeAmount?: number;
}

export interface SplitResult {
  publicKey: string;
  amount: number;
  percentage: number;
}

export interface SplitOptions {
  minPerWalletAmount?: number;
  maxWallets?: number;
  excludeZeroWeights?: boolean;
}

/**
 * Split algorithm implementation as specified in the technical specification
 * @param total Total amount to split
 * @param weights Array of weights for each wallet
 * @returns Array of amounts for each wallet
 */
export function splitAlgorithm(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  
  // Handle edge case: all weights are approximately 0
  if (sum <= 0) {
    throw new Error('All weights are zero or negative - cannot split amount');
  }
  
  return weights.map(w => Number(((total * w) / sum).toFixed(6)));
}

/**
 * Enhanced split algorithm with wallet information and options
 */
export function splitAmountAcrossWallets(
  totalAmount: number,
  wallets: WalletWeight[],
  options: SplitOptions = {}
): SplitResult[] {
  const {
    minPerWalletAmount = 0.001, // 0.001 SOL minimum as specified
    maxWallets,
    excludeZeroWeights = true
  } = options;

  // Filter wallets based on options
  let eligibleWallets = wallets;
  
  if (excludeZeroWeights) {
    eligibleWallets = wallets.filter(w => w.weight > 0);
  }

  if (eligibleWallets.length === 0) {
    throw new Error('No eligible wallets for trade splitting');
  }

  // Limit number of wallets if specified
  if (maxWallets && eligibleWallets.length > maxWallets) {
    // Sort by weight descending and take top wallets
    eligibleWallets = eligibleWallets
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxWallets);
  }

  // Extract weights and apply core algorithm
  const weights = eligibleWallets.map(w => w.weight);
  const amounts = splitAlgorithm(totalAmount, weights);

  // Create results with validation
  const results: SplitResult[] = [];
  let totalAllocated = 0;

  for (let i = 0; i < eligibleWallets.length; i++) {
    const wallet = eligibleWallets[i];
    const amount = amounts[i];

    if (!wallet || amount === undefined) {
      continue;
    }

    // Apply minimum trade amount
    const minAmount = wallet.minTradeAmount || minPerWalletAmount;
    if (amount < minAmount) {
      // Skip this wallet if amount is too small
      continue;
    }

    const percentage = (amount / totalAmount) * 100;

    results.push({
      publicKey: wallet.publicKey,
      amount,
      percentage
    });

    totalAllocated += amount;
  }

  // Handle case where no wallets meet minimum requirements
  if (results.length === 0) {
    throw new Error(`No wallets meet minimum trade amount of ${minPerWalletAmount}`);
  }

  // Adjust for rounding errors - distribute remainder to largest allocation
  const remainder = totalAmount - totalAllocated;
  if (Math.abs(remainder) > 0.000001 && results.length > 0) { // Only adjust if significant remainder
    const largestIndex = results.reduce((maxIdx, result, idx) =>
      result.amount > results[maxIdx]!.amount ? idx : maxIdx, 0
    );

    const largestResult = results[largestIndex];
    if (largestResult) {
      largestResult.amount += remainder;
      largestResult.percentage = (largestResult.amount / totalAmount) * 100;
    }
  }

  return results;
}

/**
 * Validate split results
 */
export function validateSplitResults(
  results: SplitResult[],
  originalTotal: number,
  tolerance: number = 0.000001
): boolean {
  const totalAllocated = results.reduce((sum, result) => sum + result.amount, 0);
  const difference = Math.abs(totalAllocated - originalTotal);
  
  return difference <= tolerance;
}

/**
 * Create wallet weights from SOL balances for buy operations
 */
export function createBuyWeights(
  wallets: Array<{ publicKey: string; solBalance: number }>,
  minBalance: number = 0.001
): WalletWeight[] {
  return wallets
    .filter(w => w.solBalance >= minBalance)
    .map(w => ({
      publicKey: w.publicKey,
      weight: w.solBalance,
      minTradeAmount: minBalance
    }));
}

/**
 * Create wallet weights from token balances for sell operations
 */
export function createSellWeights(
  wallets: Array<{ publicKey: string; tokenBalance: number }>,
  minBalance: number = 0
): WalletWeight[] {
  return wallets
    .filter(w => w.tokenBalance > minBalance)
    .map(w => ({
      publicKey: w.publicKey,
      weight: w.tokenBalance,
      minTradeAmount: minBalance
    }));
}

/**
 * Calculate optimal trade size based on available liquidity
 */
export function calculateOptimalTradeSize(
  totalAvailableBalance: number,
  targetPercentage: number = 0.1, // 10% default
  maxTradeSize?: number,
  minTradeSize: number = 0.001
): number {
  const calculatedSize = totalAvailableBalance * targetPercentage;
  
  let tradeSize = Math.max(calculatedSize, minTradeSize);
  
  if (maxTradeSize) {
    tradeSize = Math.min(tradeSize, maxTradeSize);
  }
  
  return Number(tradeSize.toFixed(6));
}

/**
 * Distribute trade size with risk management
 */
export function distributeTradeSizeWithRiskManagement(
  totalAmount: number,
  wallets: WalletWeight[],
  maxWalletsPerTrade: number = 10,
  maxPercentagePerWallet: number = 0.3 // 30% max per wallet
): SplitResult[] {
  // First, apply normal split
  const results = splitAmountAcrossWallets(totalAmount, wallets, {
    maxWallets: maxWalletsPerTrade
  });

  // Apply risk management - cap individual wallet percentages
  const maxAmountPerWallet = totalAmount * maxPercentagePerWallet;
  let excessAmount = 0;
  
  // Cap amounts and collect excess
  for (const result of results) {
    if (result.amount > maxAmountPerWallet) {
      excessAmount += result.amount - maxAmountPerWallet;
      result.amount = maxAmountPerWallet;
      result.percentage = (result.amount / totalAmount) * 100;
    }
  }

  // Redistribute excess amount to wallets that aren't at cap
  if (excessAmount > 0) {
    const eligibleForRedistribution = results.filter(r => r.amount < maxAmountPerWallet);
    
    if (eligibleForRedistribution.length > 0) {
      const redistributionWeights = eligibleForRedistribution.map(r => 
        maxAmountPerWallet - r.amount
      );
      
      const redistributionAmounts = splitAlgorithm(excessAmount, redistributionWeights);
      
      for (let i = 0; i < eligibleForRedistribution.length; i++) {
        const result = eligibleForRedistribution[i];
        const additionalAmount = redistributionAmounts[i];

        if (result && additionalAmount !== undefined) {
          result.amount = Math.min(result.amount + additionalAmount, maxAmountPerWallet);
          result.percentage = (result.amount / totalAmount) * 100;
        }
      }
    }
  }

  return results;
}
