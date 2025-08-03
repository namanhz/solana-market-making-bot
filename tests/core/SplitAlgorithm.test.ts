import {
  splitAlgorithm,
  splitAmountAcrossWallets,
  validateSplitResults,
  createBuyWeights,
  createSellWeights,
  calculateOptimalTradeSize
} from '../../src/core/SplitAlgorithm';

describe('SplitAlgorithm', () => {
  describe('splitAlgorithm', () => {
    it('should split amount proportionally to weights', () => {
      const total = 1.0;
      const weights = [0.5, 0.3, 0.2];
      const result = splitAlgorithm(total, weights);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.3);
      expect(result[2]).toBeCloseTo(0.2);
    });

    it('should handle equal weights', () => {
      const total = 1.0;
      const weights = [1, 1, 1];
      const result = splitAlgorithm(total, weights);
      
      expect(result).toHaveLength(3);
      result.forEach(amount => {
        expect(amount).toBeCloseTo(1/3);
      });
    });

    it('should throw error for zero weights', () => {
      const total = 1.0;
      const weights = [0, 0, 0];
      
      expect(() => splitAlgorithm(total, weights)).toThrow('All weights are zero or negative');
    });

    it('should handle single wallet', () => {
      const total = 1.0;
      const weights = [1];
      const result = splitAlgorithm(total, weights);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeCloseTo(1.0);
    });
  });

  describe('splitAmountAcrossWallets', () => {
    const mockWallets = [
      { publicKey: 'wallet1', weight: 0.5 },
      { publicKey: 'wallet2', weight: 0.3 },
      { publicKey: 'wallet3', weight: 0.2 }
    ];

    it('should split amount across wallets', () => {
      const result = splitAmountAcrossWallets(1.0, mockWallets);

      expect(result).toHaveLength(3);
      expect(result[0]?.publicKey).toBe('wallet1');
      expect(result[0]?.amount).toBeCloseTo(0.5);
      expect(result[1]?.amount).toBeCloseTo(0.3);
      expect(result[2]?.amount).toBeCloseTo(0.2);
    });

    it('should exclude zero weight wallets', () => {
      const walletsWithZero = [
        ...mockWallets,
        { publicKey: 'wallet4', weight: 0 }
      ];
      
      const result = splitAmountAcrossWallets(1.0, walletsWithZero);
      expect(result).toHaveLength(3);
    });

    it('should respect minimum trade amount', () => {
      const result = splitAmountAcrossWallets(1.0, mockWallets, {
        minPerWalletAmount: 0.4
      });

      // Only wallet1 (0.5) should meet the minimum
      expect(result).toHaveLength(1);
      expect(result[0]?.publicKey).toBe('wallet1');
    });

    it('should limit number of wallets', () => {
      const result = splitAmountAcrossWallets(1.0, mockWallets, {
        maxWallets: 2
      });

      expect(result).toHaveLength(2);
      // Should take the top 2 by weight
      expect(result[0]?.publicKey).toBe('wallet1');
      expect(result[1]?.publicKey).toBe('wallet2');
    });
  });

  describe('validateSplitResults', () => {
    it('should validate correct split results', () => {
      const results = [
        { publicKey: 'wallet1', amount: 0.5, percentage: 50 },
        { publicKey: 'wallet2', amount: 0.3, percentage: 30 },
        { publicKey: 'wallet3', amount: 0.2, percentage: 20 }
      ];
      
      const isValid = validateSplitResults(results, 1.0);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect split results', () => {
      const results = [
        { publicKey: 'wallet1', amount: 0.5, percentage: 50 },
        { publicKey: 'wallet2', amount: 0.3, percentage: 30 }
        // Missing 0.2
      ];
      
      const isValid = validateSplitResults(results, 1.0);
      expect(isValid).toBe(false);
    });
  });

  describe('createBuyWeights', () => {
    it('should create weights from SOL balances', () => {
      const wallets = [
        { publicKey: 'wallet1', solBalance: 1.0 },
        { publicKey: 'wallet2', solBalance: 0.5 },
        { publicKey: 'wallet3', solBalance: 0.0005 } // Below minimum
      ];
      
      const weights = createBuyWeights(wallets, 0.001);
      
      expect(weights).toHaveLength(2); // Third wallet filtered out
      expect(weights[0]?.weight).toBe(1.0);
      expect(weights[1]?.weight).toBe(0.5);
    });
  });

  describe('createSellWeights', () => {
    it('should create weights from token balances', () => {
      const wallets = [
        { publicKey: 'wallet1', tokenBalance: 100 },
        { publicKey: 'wallet2', tokenBalance: 50 },
        { publicKey: 'wallet3', tokenBalance: 0 }
      ];
      
      const weights = createSellWeights(wallets, 0);
      
      expect(weights).toHaveLength(2); // Third wallet filtered out
      expect(weights[0]?.weight).toBe(100);
      expect(weights[1]?.weight).toBe(50);
    });
  });

  describe('calculateOptimalTradeSize', () => {
    it('should calculate trade size as percentage of balance', () => {
      const tradeSize = calculateOptimalTradeSize(10.0, 0.1); // 10% of 10 SOL
      expect(tradeSize).toBe(1.0);
    });

    it('should respect minimum trade size', () => {
      const tradeSize = calculateOptimalTradeSize(0.005, 0.1, undefined, 0.001);
      expect(tradeSize).toBe(0.001); // Should use minimum
    });

    it('should respect maximum trade size', () => {
      const tradeSize = calculateOptimalTradeSize(100.0, 0.1, 5.0);
      expect(tradeSize).toBe(5.0); // Should cap at maximum
    });
  });
});
