#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const environment = process.argv[2];
if (!environment || !['dev', 'staging', 'prod'].includes(environment)) {
  console.error('❌ Usage: node git-push.js <dev|staging|prod>');
  process.exit(1);
}

// Read current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`🚀 Preparing ${environment} release`);
console.log(`📦 Version: ${version}`);

try {
  // Check if we have uncommitted changes (excluding package.json which we just updated)
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const nonPackageChanges = status
      .split('\n')
      .filter(line => line.trim() && !line.includes('package.json'))
      .join('\n');
    
    if (nonPackageChanges) {
      console.log('⚠️  Uncommitted changes detected (excluding package.json):');
      console.log(nonPackageChanges);
      console.log('Please commit or stash changes before releasing.');
      process.exit(1);
    }
  } catch (error) {
    // git status failed, might not be a git repo
    console.warn('⚠️  Could not check git status');
  }

  // Add package.json changes
  console.log('📝 Adding version changes...');
  execSync('git add package.json', { stdio: 'inherit' });

  // Create commit message based on environment
  let commitMessage;
  switch (environment) {
    case 'dev':
      commitMessage = `chore: bump version to ${version} for development`;
      break;
    case 'staging':
      commitMessage = `chore: release ${version} to staging`;
      break;
    case 'prod':
      commitMessage = `chore: release ${version}`;
      break;
  }

  // Commit the version change
  console.log(`💾 Committing: ${commitMessage}`);
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

  // Create and push tag for staging and prod
  if (environment === 'staging' || environment === 'prod') {
    const tagName = environment === 'prod' ? `v${version}` : `${environment}-v${version}`;
    console.log(`🏷️  Creating tag: ${tagName}`);
    execSync(`git tag ${tagName}`, { stdio: 'inherit' });
  }

  // Get current branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  console.log(`🌿 Current branch: ${currentBranch}`);

  // Push commits
  console.log('📤 Pushing commits...');
  execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });

  // Push tags for staging and prod
  if (environment === 'staging' || environment === 'prod') {
    const tagName = environment === 'prod' ? `v${version}` : `${environment}-v${version}`;
    console.log(`📤 Pushing tag: ${tagName}`);
    execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
  }

  console.log(`\n✅ Successfully released ${version} to ${environment}`);
  console.log(`🔗 GitHub workflows will handle Docker building and deployment`);
  
  if (environment === 'prod') {
    console.log(`🏷️  Tagged as: v${version}`);
  } else if (environment === 'staging') {
    console.log(`🏷️  Tagged as: staging-v${version}`);
  }

} catch (error) {
  console.error(`❌ Release failed: ${error.message}`);
  process.exit(1);
}