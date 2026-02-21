#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const apiSrcRoot = path.join(repoRoot, 'apps', 'api', 'src');

const ALLOWED_TELEGRAF_IMPORT_FILES = new Set([
  normalize(path.join(apiSrcRoot, 'services', 'TelegrafBot.ts')),
  normalize(path.join(apiSrcRoot, 'services', 'BotManager.ts')),
]);

const ALLOWED_RAW_TELEGRAM_SEND_FILES = new Set([
  normalize(path.join(apiSrcRoot, 'services', 'TelegrafBot.ts')),
]);

const ALLOWED_RECIPIENT_QUERY_FILES = new Set([
  normalize(path.join(apiSrcRoot, 'services', 'AlertDispatchService.ts')),
  normalize(path.join(apiSrcRoot, 'routes', 'observabilityAdmin.ts')),
]);

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function listSourceFiles(dir) {
  const result = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) continue;

      result.push(fullPath);
    }
  }

  walk(dir);
  return result;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function collectViolations() {
  const violations = [];
  const files = listSourceFiles(apiSrcRoot);

  for (const filePath of files) {
    const normalizedPath = normalize(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    const telegrafImportRegex = /import\s+\{?\s*TelegrafBot\s*\}?\s+from\s+['"][^'"]+TelegrafBot['"]/g;
    for (const match of content.matchAll(telegrafImportRegex)) {
      if (!ALLOWED_TELEGRAF_IMPORT_FILES.has(normalizedPath)) {
        violations.push({
          filePath: normalizedPath,
          line: getLineNumber(content, match.index || 0),
          rule: 'NO_DIRECT_TELEGRAF_IMPORT',
          details: 'Direct TelegrafBot import is forbidden outside BotManager/TelegrafBot',
        });
      }
    }

    const rawTelegramSendRegex = /\.telegram\.sendMessage\s*\(/g;
    for (const match of content.matchAll(rawTelegramSendRegex)) {
      if (!ALLOWED_RAW_TELEGRAM_SEND_FILES.has(normalizedPath)) {
        violations.push({
          filePath: normalizedPath,
          line: getLineNumber(content, match.index || 0),
          rule: 'NO_RAW_TELEGRAM_SEND',
          details: 'Raw telegram.sendMessage call detected; use AlertDispatchService',
        });
      }
    }

    const recipientsQueryRegex = /observabilityAccessService\.getTelegramRecipients\s*\(/g;
    for (const match of content.matchAll(recipientsQueryRegex)) {
      if (!ALLOWED_RECIPIENT_QUERY_FILES.has(normalizedPath)) {
        violations.push({
          filePath: normalizedPath,
          line: getLineNumber(content, match.index || 0),
          rule: 'NO_DIRECT_RECIPIENT_QUERY',
          details: 'Direct recipient query detected; use AlertDispatchService',
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations = collectViolations();

  if (!violations.length) {
    console.log('✅ Alert dispatch guard passed: no bypass patterns detected.');
    process.exit(0);
  }

  console.error('❌ Alert dispatch guard failed. Forbidden patterns found:');
  for (const violation of violations) {
    console.error(` - [${violation.rule}] ${violation.filePath}:${violation.line} :: ${violation.details}`);
  }

  process.exit(2);
}

main();
