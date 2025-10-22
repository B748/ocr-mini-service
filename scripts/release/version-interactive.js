#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`\n🔖 Current version: ${currentVersion}\n`);
console.log('Select version bump type:');
console.log(`1. Patch (${major}.${minor}.${patch + 1}) - Bug fixes`);
console.log(`2. Minor (${major}.${minor + 1}.0) - New features`);
console.log(`3. Major (${major + 1}.0.0) - Breaking changes`);
console.log('4. Custom version');
console.log('5. Keep current version');

rl.question('\nEnter your choice (1-5): ', (answer) => {
  let newVersion;
  
  switch (answer.trim()) {
    case '1':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case '2':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case '3':
      newVersion = `${major + 1}.0.0`;
      break;
    case '4':
      rl.question('Enter custom version (x.y.z): ', (customVersion) => {
        if (!/^\d+\.\d+\.\d+$/.test(customVersion)) {
          console.error('❌ Invalid version format. Use x.y.z format.');
          process.exit(1);
        }
        updateVersion(customVersion);
        rl.close();
      });
      return;
    case '5':
      console.log(`✅ Keeping current version: ${currentVersion}`);
      rl.close();
      return;
    default:
      console.error('❌ Invalid choice. Please select 1-5.');
      process.exit(1);
  }
  
  updateVersion(newVersion);
  rl.close();
});

function updateVersion(version) {
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Version updated: ${currentVersion} → ${version}`);
}