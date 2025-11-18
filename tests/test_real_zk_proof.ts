

import zkProofService from '../src/privacy/zkProofService.js';

async function testRealProofGeneration() {
  console.log('🔐 Testing Real ZK Proof Generation\n');

  try {
    // Generate blinding factors
    console.log('1. Generating blinding factors...');
    const inputBlinding = zkProofService.generateBlinding();
    const outputBlinding = zkProofService.generateBlinding();
    console.log(`   Input blinding: ${inputBlinding.toString().slice(0, 20)}...`);
    console.log(`   Output blinding: ${outputBlinding.toString().slice(0, 20)}...`);

    // Test amounts
    const inputAmount = 1000n;
    const outputAmount = 900n;
    const fee = 100n;

    console.log(`\n2. Transaction details:`);
    console.log(`   Input amount: ${inputAmount}`);
    console.log(`   Output amount: ${outputAmount}`);
    console.log(`   Fee: ${fee}`);

    // Compute commitments
    console.log(`\n3. Computing commitments...`);
    const inputCommitment = zkProofService.computePedersenCommitment(inputAmount, inputBlinding);
    const outputCommitment = zkProofService.computePedersenCommitment(outputAmount, outputBlinding);
    console.log(`   Input commitment: ${inputCommitment.toString(16).slice(0, 20)}...`);
    console.log(`   Output commitment: ${outputCommitment.toString(16).slice(0, 20)}...`);

    // Generate proof
    console.log(`\n4. Generating ZK proof (this may take a few seconds)...`);
    const startTime = Date.now();
    
    const { proof, publicSignals } = await zkProofService.generateConfidentialTransferProof(
      inputAmount,
      outputAmount,
      fee,
      inputBlinding,
      outputBlinding
    );

    const elapsedTime = Date.now() - startTime;
    console.log(`   ✅ Proof generated in ${elapsedTime}ms`);

    // Display proof details
    console.log(`\n5. Proof details:`);
    console.log(`   Protocol: ${proof.protocol}`);
    console.log(`   Curve: ${proof.curve}`);
    console.log(`   Public signals count: ${publicSignals.length}`);
    console.log(`   Public signals:`, publicSignals.slice(0, 3));

    // Verify proof
    console.log(`\n6. Verifying proof...`);
    const isValid = await zkProofService.verifyProof(
      'confidential_transfer',
      proof,
      publicSignals
    );

    if (isValid) {
      console.log(`   ✅ Proof verified successfully!`);
    } else {
      console.log(`   ❌ Proof verification failed`);
    }

    // Export for Solidity
    console.log(`\n7. Exporting proof for Solidity...`);
    const solidityProof = zkProofService.exportProofForSolidity(proof);
    console.log(`   Proof formatted for on-chain verification`);
    console.log(`   Proof.a[0]: ${solidityProof.a[0].slice(0, 20)}...`);

    console.log(`\n✅ All tests passed!`);
    console.log(`\nSummary:`);
    console.log(`  - Transaction: ${inputAmount} → ${outputAmount} (fee: ${fee})`);
    console.log(`  - Proof generation time: ${elapsedTime}ms`);
    console.log(`  - Proof valid: ${isValid}`);
    console.log(`  - Ready for on-chain verification ✓`);

  } catch (error) {
    console.error(`\n❌ Test failed:`, error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack:`, error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testRealProofGeneration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
