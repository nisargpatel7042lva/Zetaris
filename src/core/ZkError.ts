/**
 * Zero-Knowledge Proof Error Codes
 */
export enum ZkErrorCode {
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CIRCUIT_NOT_FOUND = 'CIRCUIT_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_PROOF = 'INVALID_PROOF',
  COMMITMENT_FAILED = 'COMMITMENT_FAILED',
  NULLIFIER_FAILED = 'NULLIFIER_FAILED',
}

/**
 * Zero-Knowledge Proof Error
 */
export class ZkError extends Error {
  code: ZkErrorCode;
  context?: any;

  constructor(message: string, code: ZkErrorCode, context?: any) {
    super(message);
    this.name = 'ZkError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZkError);
    }
  }
}
