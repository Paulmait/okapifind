/**
 * Jest Test Results Processor
 * Processes test results and generates custom reports
 */

module.exports = (results) => {
  const {
    numTotalTests,
    numPassedTests,
    numFailedTests,
    numPendingTests,
    testResults,
    coverageMap,
  } = results;

  console.log('\n📊 Test Results Summary:');
  console.log(`   Total Tests: ${numTotalTests}`);
  console.log(`   ✅ Passed: ${numPassedTests}`);
  console.log(`   ❌ Failed: ${numFailedTests}`);
  console.log(`   ⏸️  Pending: ${numPendingTests}`);

  // Calculate success rate
  const successRate = numTotalTests > 0 ? ((numPassedTests / numTotalTests) * 100).toFixed(2) : 0;
  console.log(`   📈 Success Rate: ${successRate}%`);

  // Show slowest tests
  if (testResults && testResults.length > 0) {
    const slowTests = testResults
      .map(result => ({
        testFilePath: result.testFilePath.replace(process.cwd(), '.'),
        perfStats: result.perfStats,
        duration: result.perfStats?.runtime || 0,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .filter(test => test.duration > 100); // Only show tests over 100ms

    if (slowTests.length > 0) {
      console.log('\n🐌 Slowest Tests:');
      slowTests.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.testFilePath} (${test.duration}ms)`);
      });
    }
  }

  // Show failed tests details
  if (numFailedTests > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.forEach(result => {
      if (result.numFailingTests > 0) {
        const filePath = result.testFilePath.replace(process.cwd(), '.');
        console.log(`   ${filePath}`);

        result.testResults.forEach(test => {
          if (test.status === 'failed') {
            console.log(`     • ${test.fullName}`);
            if (test.failureMessages.length > 0) {
              test.failureMessages.forEach(msg => {
                // Clean up the error message
                const cleanMsg = msg.split('\n')[0].trim();
                console.log(`       ${cleanMsg}`);
              });
            }
          }
        });
      }
    });
  }

  // Coverage summary (if available)
  if (coverageMap && Object.keys(coverageMap).length > 0) {
    console.log('\n📋 Coverage Summary:');
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;

    Object.values(coverageMap).forEach(fileCoverage => {
      if (fileCoverage.s) { // statements
        totalLines += Object.keys(fileCoverage.s).length;
        coveredLines += Object.values(fileCoverage.s).filter(count => count > 0).length;
      }
      if (fileCoverage.f) { // functions
        totalFunctions += Object.keys(fileCoverage.f).length;
        coveredFunctions += Object.values(fileCoverage.f).filter(count => count > 0).length;
      }
      if (fileCoverage.b) { // branches
        Object.values(fileCoverage.b).forEach(branch => {
          totalBranches += branch.length;
          coveredBranches += branch.filter(count => count > 0).length;
        });
      }
    });

    if (totalLines > 0) {
      const lineCoverage = ((coveredLines / totalLines) * 100).toFixed(2);
      console.log(`   Lines: ${coveredLines}/${totalLines} (${lineCoverage}%)`);
    }

    if (totalFunctions > 0) {
      const functionCoverage = ((coveredFunctions / totalFunctions) * 100).toFixed(2);
      console.log(`   Functions: ${coveredFunctions}/${totalFunctions} (${functionCoverage}%)`);
    }

    if (totalBranches > 0) {
      const branchCoverage = ((coveredBranches / totalBranches) * 100).toFixed(2);
      console.log(`   Branches: ${coveredBranches}/${totalBranches} (${branchCoverage}%)`);
    }
  }

  // Generate custom report file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: numTotalTests,
      passedTests: numPassedTests,
      failedTests: numFailedTests,
      pendingTests: numPendingTests,
      successRate: successRate,
    },
    testResults: testResults.map(result => ({
      file: result.testFilePath.replace(process.cwd(), '.'),
      numTests: result.numFailingTests + result.numPassingTests + result.numPendingTests,
      passed: result.numPassingTests,
      failed: result.numFailingTests,
      pending: result.numPendingTests,
      duration: result.perfStats?.runtime || 0,
    })),
  };

  // Write to file (only in CI or if explicitly requested)
  if (process.env.CI || process.env.GENERATE_TEST_REPORT) {
    const fs = require('fs');
    const path = require('path');

    try {
      const reportPath = path.join(process.cwd(), 'test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 Test report generated: test-report.json`);
    } catch (error) {
      console.warn('\n⚠️  Could not generate test report file:', error.message);
    }
  }

  // Performance warnings
  if (testResults && testResults.some(result => (result.perfStats?.runtime || 0) > 5000)) {
    console.log('\n⚠️  Some tests are taking longer than 5 seconds. Consider optimizing or breaking them down.');
  }

  console.log(''); // Empty line for spacing

  return results;
};