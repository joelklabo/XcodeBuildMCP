import * as xcpretty from '@expo/xcpretty';

console.log('xcpretty module:', xcpretty);
console.log('Module type:', typeof xcpretty);

if (typeof xcpretty === 'function') {
  console.log('xcpretty is a function');
} else {
  console.log('Properties:', Object.keys(xcpretty));
  
  for (const key of Object.keys(xcpretty)) {
    console.log(`- ${key}:`, typeof xcpretty[key]);
  }
}

// Try to use the functionality mentioned in the readme
try {
  console.log('\nTrying xcpretty functionality:');
  const result = xcpretty('echo "Testing xcpretty"');
  console.log('Result:', result);
} catch (e) {
  console.log('Error calling xcpretty directly:', e.message);
}
