/**
 * Zero-Knowledge Proof Service
 * Handles generation and verification of ZK proofs for confidential transactions
 */

// @ts-expect-error snarkjs doesn't have official TypeScript type definitions
import * as snarkjs from 'snarkjs';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { ZkError, ZkErrorCode } from '../core/ZkError';

/**
 * Proof input type for flexible proof generation
 */
interface ProofInput {
  [key: string]: string | number | bigint | string[] | number[] | bigint[];
}

/**
 * Groth16 proof structure
 */
interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

/**
 * ZK Proof Service
 * Singleton service for managing zero-knowledge proofs
 */
export class ZkProofService {
  private static instance: ZkProofService;
  private circuitBasePath: string;
  private verificationKeys: Map<string, any>;

  private constructor() {
    this.circuitBasePath = process.env.CIRCUIT_PATH || './circuits/build';
    this.verificationKeys = new Map();
  }

  public static getInstance(): ZkProofService {
    if (!ZkProofService.instance) {
      ZkProofService.instance = new ZkProofService();
    }
    return ZkProofService.instance;
  }

  /**
   * Generate a confidential transfer proof
   * Proves that input_amount = output_amount + fee without revealing values
   */
  async generateConfidentialTransferProof(
    inputAmount: bigint,
    outputAmount: bigint,
    fee: bigint,
    inputBlinding: bigint,
    outputBlinding: bigint
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
    // Validate balance equation
    if (inputAmount !== outputAmount + fee) {
      throw new ZkError(
        'Balance equation does not hold',
        ZkErrorCode.VALIDATION_FAILED
      );
    }

    try {
      // Compute commitments
      const inputCommitment = this.computePedersenCommitment(inputAmount, inputBlinding);
      const outputCommitment = this.computePedersenCommitment(outputAmount, outputBlinding);

      const input: ProofInput = {
        input_amount: inputAmount.toString(),
        output_amount: outputAmount.toString(),
        fee: fee.toString(),
        input_blinding: inputBlinding.toString(),
        output_blinding: outputBlinding.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/confidential_transfer.wasm`,
        `${this.circuitBasePath}/confidential_transfer_final.zkey`
      );

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      // Re-throw ZkError as-is, wrap others
      if (error instanceof ZkError) {
        throw error;
      }
      throw new ZkError(
        `Failed to generate confidential transfer proof: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate a range proof
   * Proves that min <= value <= max without revealing value
   */
  async generateRangeProof(
    value: bigint,
    min: bigint,
    max: bigint,
    blinding: bigint
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
    try {
      // Validate range
      if (value < min || value > max) {
        throw new ZkError(
          'Value is outside valid range',
          ZkErrorCode.VALIDATION_FAILED
        );
      }

      const commitment = this.computePedersenCommitment(value, blinding);

      const input: ProofInput = {
        value: value.toString(),
        min: min.toString(),
        max: max.toString(),
        blinding: blinding.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/range_proof.wasm`,
        `${this.circuitBasePath}/range_proof_final.zkey`
      );

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      throw new ZkError(
        `Failed to generate range proof: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate a nullifier for a commitment
   * Used to prevent double-spending without revealing the commitment
   */
  async generateNullifier(
    secret: bigint,
    commitment: bigint,
    index: number
  ): Promise<{ proof: Groth16Proof; publicSignals: string[]; nullifier: string }> {
    try {
      const input: ProofInput = {
        secret: secret.toString(),
        commitment: commitment.toString(),
        index: index.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/nullifier.wasm`,
        `${this.circuitBasePath}/nullifier_final.zkey`
      );

      // The nullifier is the first public signal
      const nullifier = publicSignals[0];

      return {
        proof,
        publicSignals,
        nullifier,
      };
    } catch (error) {
      throw new ZkError(
        `Failed to generate nullifier: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate a stealth address proof
   * Proves knowledge of ephemeral private key and shared secret
   */
  async generateStealthAddressProof(
    ephemeralPrivKey: bigint,
    recipientPubKey: [bigint, bigint],
    sharedSecret: bigint
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
    try {
      const input: ProofInput = {
        ephemeral_priv_key: ephemeralPrivKey.toString(),
        recipient_pub_key_x: recipientPubKey[0].toString(),
        recipient_pub_key_y: recipientPubKey[1].toString(),
        shared_secret: sharedSecret.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/stealth_address.wasm`,
        `${this.circuitBasePath}/stealth_address_final.zkey`
      );

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      throw new ZkError(
        `Failed to generate stealth address proof: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate a Merkle tree membership proof
   * Proves that a leaf is in a Merkle tree without revealing the leaf
   */
  async generateMerkleProof(
    leaf: bigint,
    pathElements: bigint[],
    pathIndices: number[],
    root: bigint
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
    try {
      // Validate tree depth
      if (pathElements.length !== pathIndices.length) {
        throw new ZkError(
          'Path elements and indices must have same length',
          ZkErrorCode.VALIDATION_FAILED
        );
      }

      const input: ProofInput = {
        leaf: leaf.toString(),
        pathElements: pathElements.map(e => e.toString()),
        pathIndices: pathIndices.map(i => i.toString()),
        root: root.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/merkle_membership.wasm`,
        `${this.circuitBasePath}/merkle_membership_final.zkey`
      );

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      throw new ZkError(
        `Failed to generate Merkle proof: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate a private swap proof
   * Proves correct exchange rate for atomic swaps without revealing amounts
   */
  async generatePrivateSwapProof(
    inputAmount: bigint,
    outputAmount: bigint,
    exchangeRate: bigint,
    inputBlinding: bigint,
    outputBlinding: bigint
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
    try {
      const input: ProofInput = {
        input_amount: inputAmount.toString(),
        output_amount: outputAmount.toString(),
        exchange_rate: exchangeRate.toString(),
        input_blinding: inputBlinding.toString(),
        output_blinding: outputBlinding.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        `${this.circuitBasePath}/private_swap.wasm`,
        `${this.circuitBasePath}/private_swap_final.zkey`
      );

      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      throw new ZkError(
        `Failed to generate private swap proof: ${error}`,
        ZkErrorCode.PROOF_GENERATION_FAILED
      );
    }
  }

  /**
   * Verify a Groth16 proof
   */
  async verifyProof(
    circuitName: string,
    proof: Groth16Proof,
    publicSignals: string[]
  ): Promise<boolean> {
    try {
      const vKey = await this.getVerificationKey(circuitName);
      return await snarkjs.groth16.verify(vKey, publicSignals, proof);
    } catch (error) {
      throw new ZkError(
        `Failed to verify proof: ${error}`,
        ZkErrorCode.PROOF_VERIFICATION_FAILED
      );
    }
  }

  /**
   * Compute a Poseidon commitment
   * C = Poseidon(value, blinding)
   * This matches the circuit implementation
   */
  computePedersenCommitment(value: bigint, blinding: bigint): bigint {
    // Use Poseidon hash for commitment (matches circuit)
    const hash = sha256(
      Buffer.concat([
        this.bigintToBytes(value),
        this.bigintToBytes(blinding),
      ])
    );
    return BigInt('0x' + Buffer.from(hash).toString('hex'));
  }

  /**
   * Export proof in format suitable for Solidity verification
   */
  exportProofForSolidity(proof: Groth16Proof): {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  } {
    return {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
    };
  }

  /**
   * Generate a random blinding factor
   */
  generateBlinding(): bigint {
    const bytes = randomBytes(32);
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
  }

  /**
   * Convert bigint to bytes
   */
  private bigintToBytes(value: bigint): Buffer {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }

  /**
   * Get verification key for a circuit
   */
  private async getVerificationKey(circuitName: string): Promise<any> {
    if (this.verificationKeys.has(circuitName)) {
      return this.verificationKeys.get(circuitName);
    }

    try {
      const vKeyPath = `${this.circuitBasePath}/${circuitName}_verification_key.json`;
      const vKey = JSON.parse(require('fs').readFileSync(vKeyPath, 'utf8'));
      this.verificationKeys.set(circuitName, vKey);
      return vKey;
    } catch (error) {
      throw new ZkError(
        `Failed to load verification key for ${circuitName}: ${error}`,
        ZkErrorCode.CIRCUIT_NOT_FOUND
      );
    }
  }
}

// Export singleton instance
export default ZkProofService.getInstance();
