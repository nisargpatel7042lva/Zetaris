//! MeshCrypt Core Library
//!
//! Production-grade privacy-first cryptocurrency wallet core.
//! Implements HD wallet, Pedersen commitments, stealth addresses, and encrypted storage.
//!
//! # Security
//!
//! - All sensitive data is zeroized on drop
//! - Keys stored encrypted with AES-256-GCM
//! - Uses hardware-backed keystores where available
//! - Audited cryptographic primitives from curve25519-dalek
//!
//! # Architecture
//!
//! ```text
//! KeyManager → WalletState → TransactionBuilder → ProofManager
//!     ↓            ↓               ↓
//! Commitments  Storage        ZK Proofs
//! ```

pub mod commitments;
pub mod crypto;
pub mod key_manager;
pub mod storage;
pub mod transaction_builder;
pub mod wallet_state;

// Re-exports
pub use commitments::{PedersenCommitment, RangeProof};
pub use key_manager::{KeyManager, Account, AccountDerivation};
pub use transaction_builder::{TransactionBuilder, PrivateTransaction};
pub use wallet_state::{WalletState, EncryptedState};

use thiserror::Error;

/// Result type for core operations
pub type Result<T> = std::result::Result<T, CoreError>;

/// Core error types
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    
    #[error("Key derivation failed: {0}")]
    KeyDerivation(String),
    
    #[error("Commitment error: {0}")]
    Commitment(String),
    
    #[error("Storage error: {0}")]
    Storage(String),
    
    #[error("Cryptographic error: {0}")]
    Crypto(String),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
}

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const AUTHORS: &str = env!("CARGO_PKG_AUTHORS");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
        assert!(!AUTHORS.is_empty());
    }
}
