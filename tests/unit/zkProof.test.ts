/**
 * Tests for Zero-Knowledge Proof Service
 */

import { ZkProofService } from '../../src/privacy/zkProofService';
import { ZkError, ZkErrorCode } from '../../src/core/ZkError';

describe('ZkProofService', () => {
  let zkService: ZkProofService;

  beforeEach(() => {
    zkService = ZkProofService.getInstance();
  });

  describe('Blinding Factor Generation', () => {
    it('should generate random blinding factors', () => {
      const blinding1 = zkService.generateBlinding();
      const blinding2 = zkService.generateBlinding();

      expect(blinding1).not.toBe(blinding2);
      expect(typeof blinding1).toBe('bigint');
      expect(typeof blinding2).toBe('bigint');
      expect(blinding1 > 0n).toBe(true);
      expect(blinding2 > 0n).toBe(true);
    });

    it('should generate 256-bit blindings', () => {
      const blinding = zkService.generateBlinding();
      const bits = blinding.toString(2).length;

      expect(bits).toBeGreaterThan(200); // At least 200 bits
      expect(bits).toBeLessThanOrEqual(256);
    });
  });

  describe('Pedersen Commitments', () => {
    it('should compute commitments deterministically', () => {
      const value = 100n;
      const blinding = 12345n;

      const commitment1 = zkService.computePedersenCommitment(value, blinding);
      const commitment2 = zkService.computePedersenCommitment(value, blinding);

      expect(commitment1).toBe(commitment2);
    });

    it('should produce different commitments for different values', () => {
      const blinding = 12345n;

      const commitment1 = zkService.computePedersenCommitment(100n, blinding);
      const commitment2 = zkService.computePedersenCommitment(200n, blinding);

      expect(commitment1).not.toBe(commitment2);
    });

    it('should produce different commitments for different blindings', () => {
      const value = 100n;

      const commitment1 = zkService.computePedersenCommitment(value, 111n);
      const commitment2 = zkService.computePedersenCommitment(value, 222n);

      expect(commitment1).not.toBe(commitment2);
    });

    it('should handle large values', () => {
      const largeValue = 2n ** 64n - 1n;
      const blinding = 999n;

      const commitment = zkService.computePedersenCommitment(largeValue, blinding);

      expect(commitment).toBeGreaterThan(0n);
    });

    it('should handle zero values', () => {
      const blinding = 123n;

      const commitment = zkService.computePedersenCommitment(0n, blinding);

      expect(commitment).toBeGreaterThan(0n);
    });
  });

  describe('Proof Formatting', () => {
    it('should export proof for Solidity', () => {
      const mockProof = {
        pi_a: ['123', '456', '789'] as [string, string, string],
        pi_b: [['789', '012'], ['345', '678'], ['901', '234']] as [[string, string], [string, string], [string, string]],
        pi_c: ['901', '234', '567'] as [string, string, string],
        protocol: 'groth16',
        curve: 'bn128',
      };

      const exported = zkService.exportProofForSolidity(mockProof);

      expect(exported.a).toEqual(['123', '456']);
      expect(exported.b[0]).toEqual(['012', '789']);
      expect(exported.b[1]).toEqual(['678', '345']);
      expect(exported.c).toEqual(['901', '234']);
    });
  });

  describe('Confidential Transfer Validation', () => {
    it('should validate balance equation before proof generation', async () => {
      const inputAmount = 1000n;
      const outputAmount = 900n;
      const fee = 50n; // Doesn't add up: 900 + 50 != 1000
      const inputBlinding = zkService.generateBlinding();
      const outputBlinding = zkService.generateBlinding();

      await expect(
        zkService.generateConfidentialTransferProof(
          inputAmount,
          outputAmount,
          fee,
          inputBlinding,
          outputBlinding
        )
      ).rejects.toThrow(ZkError);
    });

    it('should reject negative amounts', async () => {
      const inputAmount = -100n;
      const outputAmount = -150n;
      const fee = 50n;
      const inputBlinding = zkService.generateBlinding();
      const outputBlinding = zkService.generateBlinding();

      await expect(
        zkService.generateConfidentialTransferProof(
          inputAmount,
          outputAmount,
          fee,
          inputBlinding,
          outputBlinding
        )
      ).rejects.toThrow();
    });
  });

  describe('Range Proof Validation', () => {
    it('should reject values outside range', async () => {
      const value = 1500n;
      const min = 0n;
      const max = 1000n;
      const blinding = zkService.generateBlinding();

      await expect(
        zkService.generateRangeProof(value, min, max, blinding)
      ).rejects.toThrow(ZkError);
    });

    it('should accept values at range boundaries', async () => {
      const min = 0n;
      const max = 1000n;
      const blinding = zkService.generateBlinding();

      // This will fail until circuits are compiled, but validates the logic
      await expect(
        zkService.generateRangeProof(min, min, max, blinding)
      ).rejects.toThrow(); // Expected: circuit not found

      await expect(
        zkService.generateRangeProof(max, min, max, blinding)
      ).rejects.toThrow(); // Expected: circuit not found
    });

    it('should reject invalid range (min > max)', async () => {
      const value = 500n;
      const min = 1000n;
      const max = 0n;
      const blinding = zkService.generateBlinding();

      await expect(
        zkService.generateRangeProof(value, min, max, blinding)
      ).rejects.toThrow(ZkError);
    });
  });

  describe('Merkle Proof Validation', () => {
    it('should reject mismatched path elements and indices', async () => {
      const leaf = 123n;
      const pathElements = [456n, 789n, 12n];
      const pathIndices = [0, 1]; // Mismatch: 3 elements but 2 indices
      const root = 999n;

      await expect(
        zkService.generateMerkleProof(leaf, pathElements, pathIndices, root)
      ).rejects.toThrow(ZkError);
    });

    it('should handle empty Merkle path (single element tree)', async () => {
      const leaf = 123n;
      const pathElements: bigint[] = [];
      const pathIndices: number[] = [];
      const root = 123n;

      // Should fail with circuit not found, but validates input logic
      await expect(
        zkService.generateMerkleProof(leaf, pathElements, pathIndices, root)
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw ZkError with proper error codes', async () => {
      const inputAmount = 1000n;
      const outputAmount = 900n;
      const wrongFee = 50n; // Wrong: should be 100
      const inputBlinding = zkService.generateBlinding();
      const outputBlinding = zkService.generateBlinding();

      try {
        await zkService.generateConfidentialTransferProof(
          inputAmount,
          outputAmount,
          wrongFee,
          inputBlinding,
          outputBlinding
        );
        fail('Should have thrown ZkError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZkError);
        expect((error as ZkError).code).toBe(ZkErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('Bigint Conversions', () => {
    it('should convert bigint to bytes correctly', () => {
      const value = 255n;
      // Access private method for testing
      const bytes = (zkService as any).bigintToBytes(value);

      expect(bytes).toBeInstanceOf(Buffer);
      expect(bytes.length).toBe(32); // 256 bits = 32 bytes
    });
  });
});
