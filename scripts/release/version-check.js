#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log(`📦 ${packageJson.name}`);
console.log(`🔖 Current version: ${packageJson.version}`);
console.log(`📝 Description: ${packageJson.description || 'No description'}`);

// Show what the next versions would be
const [major, minor, patch] = packageJson.version.split('.').map(Number);
console.log(`\n📈 Next versions:`);
console.log(`   Patch: ${major}.${minor}.${patch + 1}`);
console.log(`   Minor: ${major}.${minor + 1}.0`);
console.log(`   Major: ${major + 1}.0.0`);