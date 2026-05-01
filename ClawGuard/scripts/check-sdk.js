const sdk = require('@0gfoundation/0g-ts-sdk');
console.log('SDK exports:', Object.keys(sdk).join(', '));
console.log('Batcher methods:', Object.getOwnPropertyNames(sdk.Batcher.prototype).join(', '));
console.log('StreamDataBuilder methods:', Object.getOwnPropertyNames(sdk.StreamDataBuilder.prototype).join(', '));
console.log('STREAM_DOMAIN:', sdk.STREAM_DOMAIN);
// Check if there's a createStream or setStreamRole on StreamDataBuilder
const sdb = sdk.StreamDataBuilder.prototype;
console.log('Has createStream:', typeof sdb.createStream);
console.log('Has setRole:', typeof sdb.setRole);
console.log('Has set:', typeof sdb.set);
console.log('Has setAdmin:', typeof sdb.setAdmin);
