const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { ConfigManager, MODELS_CATALOG } = require('./src/config-manager');
const { FileManager } = require('./src/tools/file-manager');
const { WorkspaceScanner } = require('./src/tools/workspace-scanner');
const { TerminalExecutor } = require('./src/tools/terminal-executor');
const { HistoryManager } = require('./src/history-manager');
const { WebIntelligence } = require('./src/tools/web-intelligence');
const { getSystemPrompt } = require('./src/system-prompt');

async function runTests() {
  console.log('🧪 Starting Craft Agent Test Suite...\n');

  const testDir = path.join(__dirname, '__test_workspace__');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  // 1. ConfigManager & Model Catalog
  console.log('Testing ConfigManager & Model Catalog...');
  const cfgMgr = new ConfigManager(testDir);
  const cfg = cfgMgr.getConfig();
  assert.strictEqual(cfg.api.model, 'openai/gpt-5.6-terra', 'Default model should be gpt-5.6-terra');
  assert.strictEqual(cfg.terminal.defaultTimeout, 60, 'Default timeout should be 60');

  // Verify vendors in catalog
  const vendors = Object.keys(MODELS_CATALOG);
  assert.ok(vendors.includes('OpenAI'), 'Should contain OpenAI');
  assert.ok(vendors.includes('Anthropic'), 'Should contain Anthropic');
  assert.ok(vendors.includes('Google'), 'Should contain Google');
  assert.ok(vendors.includes('xAI (Grok)'), 'Should contain xAI');
  assert.ok(vendors.includes('Qwen'), 'Should contain Qwen');
  assert.ok(vendors.includes('DeepSeek'), 'Should contain DeepSeek');
  let totalModels = 0;
  vendors.forEach(v => totalModels += MODELS_CATALOG[v].length);
  console.log(`  ✓ Models catalog loaded with ${totalModels} models across ${vendors.length} vendors.`);
  assert.ok(totalModels >= 90, 'Should have 90+ models');

  // 2. FileManager (Read / Write / Patch / Security)
  console.log('\nTesting FileManager...');
  const fileMgr = new FileManager(testDir, 512000);

  // Path traversal test
  try {
    fileMgr.resolveSafePath('../../escaped.txt');
    assert.fail('Should have blocked path traversal');
  } catch (err) {
    assert.ok(err.message.includes('outside workspace boundaries'), 'Should throw boundary error');
    console.log('  ✓ Path traversal attack properly rejected.');
  }

  // Write file
  const writeRes = fileMgr.writeFile('src/main/java/com/craft/MyPlugin.java', 'package com.craft;\n\npublic class MyPlugin {\n    public void onEnable() {\n        System.out.println("Hello");\n    }\n}\n');
  assert.strictEqual(writeRes.success, true);
  console.log('  ✓ Write file succeeded.');

  // Read file
  const readRes = fileMgr.readFile('src/main/java/com/craft/MyPlugin.java');
  assert.strictEqual(readRes.success, true);
  assert.ok(readRes.content.includes('public void onEnable()'));
  console.log('  ✓ Read file succeeded.');

  // Patch file
  const patchRes = fileMgr.patchFile(
    'src/main/java/com/craft/MyPlugin.java',
    'System.out.println("Hello");',
    'getLogger().info("Craft Agent plugin enabled!");'
  );
  assert.strictEqual(patchRes.success, true);
  const verifyPatched = fileMgr.readFile('src/main/java/com/craft/MyPlugin.java');
  assert.ok(verifyPatched.content.includes('getLogger().info("Craft Agent plugin enabled!");'));
  assert.ok(!verifyPatched.content.includes('System.out.println("Hello");'));
  console.log('  ✓ Patch file succeeded.');

  // Download file test
  const dlRes = await fileMgr.downloadFile('https://example.com/', 'downloads/example.html');
  assert.strictEqual(dlRes.success, true);
  assert.ok(fs.existsSync(path.join(testDir, 'downloads/example.html')));
  console.log('  ✓ Download file succeeded.');

  // 3. WorkspaceScanner (.forgeignore & tree)
  console.log('\nTesting WorkspaceScanner...');
  fs.writeFileSync(path.join(testDir, '.forgeignore'), 'target\n*.secret\n');
  fs.mkdirSync(path.join(testDir, 'target'), { recursive: true });
  fs.writeFileSync(path.join(testDir, 'target', 'build.jar'), 'dummy');
  fs.writeFileSync(path.join(testDir, 'test.secret'), 'topsecret');
  fs.writeFileSync(path.join(testDir, 'pom.xml'), '<project></project>');

  const scanner = new WorkspaceScanner(testDir);
  const scanResult = scanner.scan();
  assert.strictEqual(scanResult.success, true);
  assert.ok(scanResult.tree.includes('pom.xml'));
  assert.ok(!scanResult.tree.includes('build.jar'), 'target/ folder should be ignored by .forgeignore');
  assert.ok(!scanResult.tree.includes('test.secret'), '*.secret should be ignored by .forgeignore');
  console.log('  ✓ Workspace scanner respects .forgeignore.');

  // 4. TerminalExecutor (Human-In-The-Loop & AI Timeout)
  console.log('\nTesting TerminalExecutor...');
  const term = new TerminalExecutor(testDir, 60, 'powershell');

  // Test Human-In-The-Loop Rejection
  term.setConfirmCallback(async (req) => {
    return false; // User clicks "Deny"
  });
  const rejectedExec = await term.executeCommand('echo "dangerous command"');
  assert.strictEqual(rejectedExec.success, false);
  assert.ok(rejectedExec.error.includes('rejected terminal command'));
  console.log('  ✓ Terminal human-in-the-loop user denial verified.');

  // Test Human-In-The-Loop Approval + Execution
  term.setConfirmCallback(async (req) => {
    return true; // User clicks "Approve"
  });
  const approvedExec = await term.executeCommand('echo "CraftAgentActive"');
  assert.strictEqual(approvedExec.success, true);
  assert.ok(approvedExec.stdout.includes('CraftAgentActive'));
  console.log('  ✓ Terminal human-in-the-loop user approval and stdout verified.');

  // Test AI-adjustable timeout parameter
  term.setConfirmCallback(async () => true);
  const quickTimeoutExec = await term.executeCommand('Start-Sleep -Seconds 3', 1); // Timeout in 1s
  assert.strictEqual(quickTimeoutExec.success, false);
  assert.ok(quickTimeoutExec.error.includes('timed out'));
  console.log('  ✓ AI-adjustable timeout parameter properly enforced.');

  // 5. HistoryManager (15-message sliding window & tool pair integrity)
  console.log('\nTesting HistoryManager...');
  const hist = new HistoryManager(15);
  for (let i = 1; i <= 20; i++) {
    hist.addMessage({ role: 'user', content: `Message ${i}` });
    hist.addMessage({ role: 'assistant', content: `Response ${i}` });
  }
  const apiMessages = hist.getMessagesForAPI(getSystemPrompt(testDir));
  assert.strictEqual(apiMessages[0].role, 'system', 'System prompt must always be preserved at index 0');
  assert.ok(apiMessages.length <= 16, `Message count (${apiMessages.length}) should respect sliding window (max 15 messages + system prompt)`);
  console.log(`  ✓ Sliding window active: ${apiMessages.length - 1} messages sent to API out of 40 total history.`);

  // 6. WebIntelligence (DuckDuckGo search)
  console.log('\nTesting WebIntelligence...');
  const web = new WebIntelligence();
  const searchRes = await web.webSearch('PaperMC Minecraft documentation', 3);
  console.log(`  ✓ Web search executed: status=${searchRes.success}, results found=${searchRes.results ? searchRes.results.length : 0}`);

  // Cleanup test workspace
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Everything is verified.');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
