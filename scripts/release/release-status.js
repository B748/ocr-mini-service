#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`📦 ${packageJson.name} v${version}`);
console.log(`📝 ${packageJson.description}\n`);

// Check git status
try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  console.log(`🌿 Current branch: ${currentBranch}`);

  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  if (status.trim()) {
    console.log('📋 Uncommitted changes:');
    console.log(status);
  } else {
    console.log('✅ Working directory clean');
  }

  // Show recent commits
  console.log('\n📜 Recent commits:');
  const recentCommits = execSync('git log --oneline -5', { encoding: 'utf8' });
  console.log(recentCommits);

  // Show existing tags
  try {
    const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' }).trim();
    if (tags) {
      console.log('🏷️  Recent tags:');
      console.log(tags.split('\n').slice(0, 5).join('\n'));
    } else {
      console.log('🏷️  No tags found');
    }
  } catch (error) {
    console.log('🏷️  No tags found');
  }

} catch (error) {
  console.log('⚠️  Not a git repository or git not available');
}

console.log('\n🚀 Available release commands:');
console.log('  npm run push:dev     - Auto patch bump + commit + push');
console.log('  npm run push:staging - Interactive version + commit + tag + push');
console.log('  npm run push:prod    - Interactive version + commit + tag + push');