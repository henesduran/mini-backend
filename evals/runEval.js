// Runs every case in evals/cases.json through the live /enrich endpoint
// and reports how many matched on category (the field we can objectively
// grade). Requires the server to already be running.
//
// Usage: node evals/runEval.js [url]   (default url: http://localhost:3000/enrich)

const cases = require('./cases.json');

async function main() {
  const url = process.argv[2] ?? 'http://localhost:3000/enrich';
  let correct = 0;
  const failures = [];

  for (const testCase of cases) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.input),
    });
    const body = await res.json();

    const matched = res.status === 200 && body.category === testCase.expected_category;
    if (matched) {
      correct += 1;
    } else {
      failures.push({
        name: testCase.name,
        expected: testCase.expected_category,
        got: res.status === 200 ? body.category : `HTTP ${res.status}: ${body.error}`,
      });
    }
  }

  console.log(`${correct}/${cases.length} correct`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) {
      console.log(`  ${f.name}: expected "${f.expected}", got "${f.got}"`);
    }
  }
}

main();
