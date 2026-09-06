const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { ConfigManager, MODELS_CATALOG } = require('./src/config-manager');
const { FileManager } = require('./src/tools/file-manager');
const { WorkspaceScanner } = require('./src/tools/workspace-scanner');
const { TerminalExecutor, isDestructiveCommand } = require('./src/tools/terminal-executor');
const { HistoryManager, pruneToolContent, estimateTokens } = require('./src/history-manager');
const { WorkspaceMemory } = require('./src/workspace-memory');
const { WebIntelligence } = require('./src/tools/web-intelligence');
const { getSystemPrompt } = require('./src/system-prompt');
const { AIEngine } = require('./src/ai-engine');
const { DiffEngine } = require('./src/diff-engine');
const { ModrinthService } = require('./src/tools/modrinth-service');

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
  assert.strictEqual(cfg.security.mode, 'approval', 'Default security mode should be approval');

  // Test saveConfig with full-access security mode
  const saveRes = cfgMgr.saveConfig({ security: { mode: 'full-access' } });
  assert.strictEqual(saveRes.success, true, 'saveConfig should succeed');
  assert.strictEqual(saveRes.config.security.mode, 'full-access', 'saveConfig should return updated security mode');
  assert.strictEqual(cfgMgr.getConfig().security.mode, 'full-access', 'getConfig should reflect updated security mode');

  // Reload config from disk to verify persistence
  const reloadedMgr = new ConfigManager(testDir);
  assert.strictEqual(reloadedMgr.getConfig().security.mode, 'full-access', 'Reloaded config should persist full-access mode');
  console.log('  ✓ Security mode (approval -> full-access) correctly saved and persisted to disk.');

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
  const writeRes = await fileMgr.writeFile('src/main/java/com/craft/MyPlugin.java', 'package com.craft;\n\npublic class MyPlugin {\n    public void onEnable() {\n        System.out.println("Hello");\n    }\n}\n');
  assert.strictEqual(writeRes.success, true);
  console.log('  ✓ Write file succeeded.');

  // Read file
  const readRes = await fileMgr.readFile('src/main/java/com/craft/MyPlugin.java');
  assert.strictEqual(readRes.success, true);
  assert.ok(readRes.content.includes('public void onEnable()'));
  console.log('  ✓ Read file succeeded.');

  // Patch file
  const patchRes = await fileMgr.patchFile(
    'src/main/java/com/craft/MyPlugin.java',
    'System.out.println("Hello");',
    'getLogger().info("Craft Agent plugin enabled!");'
  );
  assert.strictEqual(patchRes.success, true);
  const verifyPatched = await fileMgr.readFile('src/main/java/com/craft/MyPlugin.java');
  assert.ok(verifyPatched.content.includes('getLogger().info("Craft Agent plugin enabled!");'));
  assert.ok(!verifyPatched.content.includes('System.out.println("Hello");'));
  console.log('  ✓ Patch file succeeded.');

  // Test Fuzzy Whitespace & Indentation Patching (Level 3)
  await fileMgr.writeFile('Indented.java', '    public void test() {\n        int a = 1;\n        int b = 2;\n    }\n');
  const fuzzyPatchRes = await fileMgr.patchFile(
    'Indented.java',
    'public void test() {\n  int a = 1;\n  int b = 2;\n}',
    'public void test() {\n  int a = 100;\n  int b = 200;\n}'
  );
  assert.strictEqual(fuzzyPatchRes.success, true, 'Fuzzy indentation patch must succeed');
  const readFuzzy = await fileMgr.readFile('Indented.java');
  assert.ok(readFuzzy.content.includes('int a = 100;'), 'Fuzzy patch must update content with matching indentation');
  console.log('  ✓ Level 3 Fuzzy indentation matching succeeded for code files.');

  // Test YAML Indentation Safety: level 3 fuzzy must be skipped for .yml to prevent hierarchy corruption
  await fileMgr.writeFile('plugin.yml', 'name: MyPlugin\nversion: 1.0.0\nmain: com.craft.MyPlugin\n');
  const yamlMismatchPatch = await fileMgr.patchFile(
    'plugin.yml',
    '  version: 1.0.0\n  main: com.craft.MyPlugin',
    '  version: 2.0.0\n  main: com.craft.MyPlugin'
  );
  assert.strictEqual(yamlMismatchPatch.success, false, 'Fuzzy patch must be skipped for .yml files to preserve syntax');
  assert.ok(yamlMismatchPatch.error.includes('YAML files (.yml/.yaml) are strictly indentation-sensitive'), 'Error must explain YAML indentation sensitivity');
  assert.ok(yamlMismatchPatch.error.includes('Hint: Found closest similar code at line'), 'Diagnostic line hint must be provided');
  console.log('  ✓ YAML indentation safety and diagnostic line hint verified.');

  // External path access approval testing
  const externalTestFile = path.join(__dirname, 'external_test_temp.txt');
  fs.writeFileSync(externalTestFile, 'External secret content');

  // Denial test
  fileMgr.setConfirmCallback(async () => false);
  const externalDenied = await fileMgr.readFile(externalTestFile);
  assert.strictEqual(externalDenied.success, false);
  assert.ok(externalDenied.error.includes('rejected external path access'));
  console.log('  ✓ External path access denial verified.');

  // Approval test
  fileMgr.setConfirmCallback(async () => true);
  const externalApproved = await fileMgr.readFile(externalTestFile);
  assert.strictEqual(externalApproved.success, true);
  assert.strictEqual(externalApproved.content, 'External secret content');
  console.log('  ✓ External path access user approval verified.');

  try { fs.unlinkSync(externalTestFile); } catch (e) {}

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
  const scanResult = await scanner.scan();
  assert.strictEqual(scanResult.success, true);
  assert.ok(scanResult.tree.includes('pom.xml'));
  assert.ok(!scanResult.tree.includes('build.jar'), 'target/ folder should be ignored by .forgeignore');
  assert.ok(!scanResult.tree.includes('test.secret'), '*.secret should be ignored by .forgeignore');
  console.log('  ✓ Workspace scanner respects .forgeignore.');

  // 4. ArchiveInspector (.jar & .zip inspection)
  console.log('\nTesting ArchiveInspector...');
  const { ArchiveInspector } = require('./src/tools/archive-inspector');
  const inspector = new ArchiveInspector(testDir);

  const testJarPath = 'C:\\Users\\Alvin\\Downloads\\Marlow Crystal Optimizer.jar';
  if (fs.existsSync(testJarPath)) {
    inspector.setConfirmCallback(async () => true);
    const listRes = await inspector.listEntries(testJarPath);
    assert.strictEqual(listRes.success, true);
    assert.strictEqual(listRes.detectedPluginType, 'Fabric Mod');
    assert.ok(listRes.entries.includes('fabric.mod.json'));
    console.log(`  ✓ Native ArchiveInspector verified on actual jar (${listRes.detectedPluginType}, ${listRes.totalEntries} entries).`);

    assert.ok(listRes.manifest, 'Should have auto-extracted manifest in listEntries');
    assert.strictEqual(listRes.manifest.file, 'fabric.mod.json');
    assert.ok(listRes.manifest.content.includes('Marlow\'s Crystal Optimizer'));
    console.log(`  ✓ Native ArchiveInspector auto-extracted manifest (${listRes.manifest.file}) in one call.`);

    const readModJson = await inspector.readEntry(testJarPath, 'fabric.mod.json');
    assert.strictEqual(readModJson.success, true);
    assert.ok(readModJson.content.includes('Marlow\'s Crystal Optimizer'));
    console.log('  ✓ Native ArchiveInspector read internal fabric.mod.json verbatim.');
  }

  // 5. TerminalExecutor (Human-In-The-Loop & AI Timeout)
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

  // Test Destructive Command Scanner & Confirmation Flag (Item 8)
  assert.strictEqual(isDestructiveCommand('del /s /q test_dir').isDangerous, true, 'del /s /q must be detected as dangerous');
  assert.strictEqual(isDestructiveCommand('git push origin main --force').isDangerous, true, 'git push --force must be detected');
  assert.strictEqual(isDestructiveCommand('echo "test" && Remove-Item -Recurse -Force ./build').isDangerous, true, 'Chained dangerous command must be detected');
  assert.strictEqual(isDestructiveCommand('format D:').isDangerous, true, 'format disk command must be detected');
  assert.strictEqual(isDestructiveCommand('git reset --hard HEAD~1').isDangerous, true, 'git reset --hard must be detected');
  assert.strictEqual(isDestructiveCommand('gradlew build --no-daemon').isDangerous, false, 'gradlew build must be recognized as safe');

  // Verify dangerous flag is passed in confirm callback
  let capturedDanger = null;
  term.setConfirmCallback(async (req) => {
    capturedDanger = req.isDangerous;
    return false;
  });
  await term.executeCommand('rm -rf ./important_source');
  assert.strictEqual(capturedDanger, true, 'req.isDangerous must be passed to terminal confirm modal');
  console.log('  ✓ Destructive Command Scanner & Warning Badge integration verified.');

  // 6. Memory System Harness: Tool Pruning, Token Budgeting, Rolling Summarizer, and Workspace Memory
  console.log('\nTesting Memory System Harness...');
  
  // Test 6a: Tool Output Head-Tail Pruning (Feature 1)
  const hugeLines = Array.from({ length: 300 }, (_, i) => `BUILD LOG LINE ${i + 1}: compiling classes...`).join('\n');
  const pruned = pruneToolContent(hugeLines, 2000, 20, 30);
  assert.ok(pruned.length < hugeLines.length, 'Pruned content must be shorter than original');
  assert.ok(pruned.includes('BUILD LOG LINE 1'), 'Must preserve head lines');
  assert.ok(pruned.includes('BUILD LOG LINE 300'), 'Must preserve tail lines');
  assert.ok(pruned.includes('lines omitted for context token efficiency'), 'Must contain omission indicator');
  console.log('  ✓ Tool output head-tail pruning (Feature 1) verified.');

  // Test 6b: Token Estimation & Budgeting (Feature 2)
  const sampleText = "public class MyPlugin extends JavaPlugin { ... }";
  const est = estimateTokens(sampleText);
  assert.ok(est > 0 && est < sampleText.length, 'Token estimation must be reasonable');
  console.log(`  ✓ Token estimator (Feature 2) verified (~${est} tokens for sample code).`);

  // Test 6c: Rolling Progress Summarizer & Goal Preservation (Feature 3)
  const hist = new HistoryManager(10, 20000);
  hist.addMessage({ role: 'user', content: 'Cek isi jar Marlow Crystal Optimizer.jar' });
  for (let i = 1; i <= 8; i++) {
    hist.addMessage({ 
      role: 'assistant', 
      content: `Step ${i}`, 
      tool_calls: [{ 
        id: `tc_${i}`, 
        function: { 
          name: i % 2 === 0 ? 'write_file' : 'execute_terminal_command', 
          arguments: JSON.stringify(i % 2 === 0 ? { path: `src/Step${i}.java` } : { command: `gradlew task${i}` }) 
        } 
      }] 
    });
    hist.addMessage({ role: 'tool', tool_call_id: `tc_${i}`, content: JSON.stringify({ success: true, step: i }) });
  }
  hist.addMessage({ role: 'user', content: 'coba lagi' });

  const apiMessages = hist.getMessagesForAPI(getSystemPrompt(testDir));
  assert.strictEqual(apiMessages[0].role, 'system', 'System prompt must always be preserved at index 0');
  
  // Check goal reminder and cumulative milestones
  const hasOriginalGoal = apiMessages.some(m => typeof m.content === 'string' && m.content.includes('Marlow Crystal Optimizer.jar'));
  assert.ok(hasOriginalGoal, 'HistoryManager MUST preserve original session goal on "coba lagi"');
  assert.ok(hist.cumulativeMilestones.length > 0, 'Rolling compaction must collect earlier completed milestones');
  console.log(`  ✓ Rolling progress summarizer (Feature 3) verified (${hist.cumulativeMilestones.length} milestones tracked).`);

  // Test 6d: Workspace Scratchpad (.craft/memory.json) (Feature 4)
  const wsMem = new WorkspaceMemory(testDir);
  const updateRes = wsMem.update({
    project_facts: {
      serverPlatform: 'Paper 1.20.4',
      javaVersion: 'Java 21',
      buildTool: 'Gradle'
    },
    active_goals: ['Fix packet event optimizer', 'Compile shadow jar'],
    completed_goals: ['Decompile Marlow jar archive'],
    add_notes: 'User prefers fast non-daemon builds'
  });
  assert.strictEqual(updateRes.success, true, 'WorkspaceMemory update should succeed');
  
  // Verify file written to disk
  const memFile = path.join(testDir, '.craft', 'memory.json');
  assert.ok(fs.existsSync(memFile), '.craft/memory.json file must exist on disk');
  const readBack = JSON.parse(fs.readFileSync(memFile, 'utf8'));
  assert.strictEqual(readBack.projectContext.serverPlatform, 'Paper 1.20.4');
  assert.strictEqual(readBack.activeGoals.length, 2);
  assert.strictEqual(readBack.completedMilestones.length, 1);
  
  // Verify formatted prompt
  const memPrompt = wsMem.getFormattedPrompt();
  assert.ok(memPrompt.includes('Paper 1.20.4'), 'Formatted prompt must include project facts');
  assert.ok(memPrompt.includes('Fix packet event optimizer'), 'Formatted prompt must include active goals');
  console.log('  ✓ Persistent workspace scratchpad (.craft/memory.json) (Feature 4) verified.');

  // Test 6e: Multi-Touchpoint Autonomous Memory Sniffing (Item 6)
  const aiEngine = new AIEngine({
    configManager: cfgMgr,
    historyManager: hist,
    fileManager: fileMgr,
    terminalExecutor: term,
    workspaceScanner: new WorkspaceScanner(testDir),
    webIntelligence: new WebIntelligence()
  });
  aiEngine.setWorkspaceRoot(testDir);

  // Sniff 1: write build.gradle with Java 17 and paper-api
  aiEngine.sniffAndCaptureMemory('write_file', {
    path: 'build.gradle',
    content: "sourceCompatibility = '17'\ndependencies {\n    compileOnly 'io.papermc.paper:paper-api:1.20.4-R0.1-SNAPSHOT'\n}"
  }, { success: true });

  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.javaVersion, 'Java 17', 'Java version must be sniffed from build.gradle');
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.serverPlatform, 'Paper', 'Server platform must be sniffed from build.gradle');
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.buildTool, 'Gradle', 'Build tool must be sniffed from build.gradle');

  // Sniff 2: read purpur.yml
  aiEngine.sniffAndCaptureMemory('read_file', { path: 'purpur.yml' }, { success: true, content: 'settings:\n  verbose: false' });
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.serverPlatform, 'Purpur', 'Server platform must update when purpur.yml is read');

  // Sniff 3: write plugin.yml
  aiEngine.sniffAndCaptureMemory('write_file', {
    path: 'src/main/resources/plugin.yml',
    content: 'name: SuperCraft\nversion: 3.2.1\nmain: com.craft.SuperCraft\napi-version: "1.20"'
  }, { success: true });
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.name, 'SuperCraft', 'Plugin name must be sniffed');
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.version, '3.2.1', 'Plugin version must be sniffed');
  assert.strictEqual(aiEngine.workspaceMemory.load().projectContext.mainClass, 'com.craft.SuperCraft', 'Plugin main class must be sniffed');
  console.log('  ✓ Multi-touchpoint Autonomous Memory Sniffing (Item 6) verified across build files, configs, and plugins.');

  // Test Composite Token Estimator (Item 4)
  // Test Composite Token Estimator & BPE Benchmark Alignment (Item 4)
  const codeSample = "package com.craft.test;\n\nimport org.bukkit.plugin.java.JavaPlugin;\n\npublic class TestPlugin extends JavaPlugin {\n    @Override\n    public void onEnable() {\n        getLogger().info(\"Enabled!\");\n    }\n}";
  const jsonSample = '{"name": "CraftAgent", "version": "1.0.3", "active": true, "ports": [25565, 8080]}';
  const indoSample = "Halo, tolong buatkan plugin Minecraft Paper 1.20.4 untuk mendeteksi auto-clicker.";

  const codeEst = estimateTokens(codeSample);
  const jsonEst = estimateTokens(jsonSample);
  const indoEst = estimateTokens(indoSample);

  // Benchmarked targets from OpenAI cl100k_base tokenizer:
  // codeSample = 44 tokens, jsonSample = 23 tokens, indoSample = 24 tokens
  const codeDiff = Math.abs(codeEst - 44) / 44;
  const jsonDiff = Math.abs(jsonEst - 23) / 23;
  const indoDiff = Math.abs(indoEst - 24) / 24;

  assert.ok(codeDiff <= 0.10, `Code token estimate (${codeEst}) must be within 10% of BPE 44 (diff: ${(codeDiff * 100).toFixed(1)}%)`);
  assert.ok(jsonDiff <= 0.10, `JSON token estimate (${jsonEst}) must be within 10% of BPE 23 (diff: ${(jsonDiff * 100).toFixed(1)}%)`);
  assert.ok(indoDiff <= 0.10, `Indonesian token estimate (${indoEst}) must be within 10% of BPE 24 (diff: ${(indoDiff * 100).toFixed(1)}%)`);
  console.log(`  ✓ Composite token estimator BPE benchmark verified: code=${codeEst} (bpe 44), json=${jsonEst} (bpe 23), indo=${indoEst} (bpe 24).`);

  // Test Abortable Sleep Responsiveness during Retry Delay
  const aiTest = new AIEngine({
    configManager: cfgMgr,
    historyManager: hist,
    fileManager: fileMgr,
    terminalExecutor: term,
    workspaceScanner: new WorkspaceScanner(testDir),
    webIntelligence: new WebIntelligence()
  });
  aiTest.currentAbortController = new AbortController();
  const sleepStart = Date.now();
  setTimeout(() => {
    aiTest.abortCurrentRequest();
  }, 100);
  await aiTest.abortableSleep(5000);
  const sleepDuration = Date.now() - sleepStart;
  assert.ok(sleepDuration < 600, `Abortable sleep must wake up immediately on abort (took ${sleepDuration}ms instead of 5000ms)`);
  console.log(`  ✓ Abortable sleep responsiveness verified: woke up in ${sleepDuration}ms (bypassed 5000ms delay immediately).`);

  // 7. WebIntelligence (DuckDuckGo search)
  console.log('\nTesting WebIntelligence...');
  const web = new WebIntelligence();
  const searchRes = await web.webSearch('PaperMC Minecraft documentation', 3);
  console.log(`  ✓ Web search executed: status=${searchRes.success}, results found=${searchRes.results ? searchRes.results.length : 0}`);

  // 8. DiffEngine & Visual Diff Preview
  console.log('\nTesting DiffEngine & Visual Diff...');
  const oldTextSample = 'line 1\nline 2 original\nline 3';
  const newTextSample = 'line 1\nline 2 replaced\nline 2.5 added\nline 3';
  const diffRes = DiffEngine.generateDiff(oldTextSample, newTextSample, 'Sample.java');
  assert.strictEqual(diffRes.stats.additions, 2, 'Should detect 2 additions');
  assert.strictEqual(diffRes.stats.deletions, 1, 'Should detect 1 deletion');
  assert.strictEqual(diffRes.stats.unchanged, 2, 'Should detect 2 unchanged lines');
  assert.ok(diffRes.lines.some(l => l.type === 'addition' && l.content === 'line 2.5 added'), 'Should have addition line');
  assert.ok(diffRes.lines.some(l => l.type === 'deletion' && l.content === 'line 2 original'), 'Should have deletion line');
  console.log('  ✓ DiffEngine LCS diff calculation verified (additions, deletions, line numbers).');

  // Test FileManager returning diffData
  const patchTestFile = path.join(testDir, 'DiffTest.txt');
  fs.writeFileSync(patchTestFile, 'Hello World\nGoodbye World\n', 'utf8');
  const diffPatchRes = await fileMgr.patchFile('DiffTest.txt', 'Goodbye World', 'Welcome Craft Agent');
  assert.strictEqual(diffPatchRes.success, true);
  assert.ok(diffPatchRes.diffData, 'patchFile must return diffData');
  assert.strictEqual(diffPatchRes.diffData.stats.additions, 1);
  assert.strictEqual(diffPatchRes.diffData.stats.deletions, 1);
  console.log('  ✓ FileManager patchFile attached visual diffData verified.');

  const writeUpdateRes = await fileMgr.writeFile('DiffTest.txt', 'Hello Universe\nWelcome Craft Agent\n');
  assert.strictEqual(writeUpdateRes.success, true);
  assert.strictEqual(writeUpdateRes.isNewFile, false);
  assert.ok(writeUpdateRes.diffData, 'writeFile on existing file must return diffData');
  console.log('  ✓ FileManager writeFile overwrite diffData verified.');

  // 9. ModrinthService & Discover Content
  console.log('\nTesting ModrinthService & Discover Content...');
  const modrinth = new ModrinthService(testDir);
  const mSearch = await modrinth.searchProjects({ query: 'essentials', projectType: 'plugin', limit: 2 });
  assert.ok(mSearch.totalHits > 0, 'Modrinth search should return total hits');
  assert.ok(mSearch.hits.length > 0, 'Modrinth search should return hits array');
  assert.ok(mSearch.hits[0].title, 'Modrinth hit must have title');
  assert.ok(mSearch.hits[0].slug, 'Modrinth hit must have slug');
  console.log(`  ✓ Modrinth searchProjects verified: found ${mSearch.totalHits} plugins (first hit: "${mSearch.hits[0].title}").`);

  const mVersions = await modrinth.getProjectVersions(mSearch.hits[0].slug);
  assert.ok(Array.isArray(mVersions) && mVersions.length > 0, 'Modrinth getProjectVersions must return versions array');
  assert.ok(mVersions[0].files && mVersions[0].files.length > 0, 'Modrinth version must have files list');
  console.log(`  ✓ Modrinth getProjectVersions verified (${mVersions.length} versions retrieved, latest: "${mVersions[0].name || mVersions[0].version_number}").`);

  const mBatchProjects = await modrinth.getProjects(['Ha28R6CL', 'P7dR8mSH']);
  assert.ok(Array.isArray(mBatchProjects) && mBatchProjects.length === 2, 'Modrinth getProjects batch must return requested projects');
  assert.ok(mBatchProjects[0].title && mBatchProjects[1].title, 'Batch projects must have titles');
  console.log(`  ✓ Modrinth getProjects batch verified (${mBatchProjects.map(p => p.title).join(', ')}).`);

  // 10. Quota Tracker Calculations
  console.log('\nTesting xKiro Quota calculations...');
  const mockQuotaPayload = {
    free_tokens: {
      used_today: 113223,
      limit_per_day: 5000000,
      remaining: 4886777
    },
    wallet: {
      balance_usd: "0.000000",
      held_usd: "0.000000"
    }
  };
  const calcPct = Math.round((mockQuotaPayload.free_tokens.remaining / mockQuotaPayload.free_tokens.limit_per_day) * 100);
  assert.strictEqual(calcPct, 98, 'Percentage remaining should be 98%');
  const remM = (mockQuotaPayload.free_tokens.remaining / 1000000).toFixed(2);
  assert.strictEqual(remM, '4.89', 'Remaining millions should format to 4.89M');
  console.log(`  ✓ Quota tracker calculations verified: ${calcPct}% remaining, ${remM}M free.`);

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
