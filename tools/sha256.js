#!/usr/bin/env node
/**
 * usage:
 *   node sha256.js modules/entry.js
 *   node sha256.js modules/sidebar-admin.js
 */
const fs = require('fs');
const crypto = require('crypto');

const p = process.argv[2];
if (!p) {
  console.error('Usage: node sha256.js <file>');
  process.exit(1);
}
const buf = fs.readFileSync(p);
const hex = crypto.createHash('sha256').update(buf).digest('hex');
console.log(hex);

