/**
 * test-prompt-behavior.js
 *
 * PENTING: Ini BUKAN unit test deterministik seperti test-suite.js.
 * Ini adalah "eval" / regression check untuk PERILAKU MODEL saat menerima
 * system prompt terbaru — sesuatu yang tidak bisa diverifikasi dengan
 * assert.strictEqual biasa, karena jawaban model bisa bervariasi antar-run.
 *
 * Tujuan: setiap kali system-prompt.js diubah, jalankan script ini untuk
 * memastikan tidak ada regresi pada perilaku kunci yang sudah dijanjikan
 * (Task Relevance Gate, Tool Failure Handling, Multi-Mode Tie-Breaker, dll).
 *
 * Cara kerja: mengirim pesan uji nyata ke model (via xKiro), lalu mengecek
 * apakah RESPON MEMENUHI EKSPEKTASI PERILAKU (bukan mencocokkan teks persis).
 * Karena non-deterministik, setiap skenario dijalankan N kali (default 3)
 * dan dianggap lulus jika mayoritas run sesuai ekspektasi.
 *
 * Membutuhkan API key xKiro yang valid di environment variable XKIRO_API_KEY.
 */

const path = require('path');
const { OpenAI } = require('openai');
const { getSystemPrompt } = require('./src/system-prompt');
const { TOOLS_SCHEMA } = require('./src/ai-engine');
const { ConfigManager } = require('./src/config-manager');

let API_KEY = process.env.XKIRO_API_KEY || '';
let BASE_URL = process.env.XKIRO_BASE_URL || '';
let DEFAULT_MODEL = process.env.TEST_MODEL || '';

// Auto-fallback membaca config yang sudah tersimpan di Craft Agent (baik di workspace maupun di AppData)
try {
    const appDataPath = process.env.APPDATA ? path.join(process.env.APPDATA, 'craft-agent') : null;
    let cfg = new ConfigManager().getConfig();
    if ((!cfg?.api?.apiKey || cfg.api.apiKey.trim() === '') && appDataPath) {
        cfg = new ConfigManager(appDataPath).getConfig();
    }
    if (!API_KEY && cfg?.api?.apiKey) API_KEY = cfg.api.apiKey.trim();
    if (!BASE_URL && cfg?.api?.baseUrl) BASE_URL = cfg.api.baseUrl.trim();
    if (!DEFAULT_MODEL && cfg?.api?.model) DEFAULT_MODEL = cfg.api.model.trim();
} catch (e) {
    // abaikan jika config belum ada
}

if (!BASE_URL) BASE_URL = 'https://api.xkiro.com/v1';
if (!DEFAULT_MODEL) DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';
const MODEL = DEFAULT_MODEL;
const RUNS_PER_SCENARIO = parseInt(process.env.RUNS_PER_SCENARIO || '3', 10);

// ----------------------------------------------------------------------
// Definisi skenario uji. Setiap skenario:
// - userMessage: pesan yang dikirim ke model
// - expectNoToolCall: true jika model SEHARUSNYA tidak memanggil tool apa pun
// - expectToolCallContains: array nama tool yang SEHARUSNYA dipanggil (opsional)
// - notes: konteks kenapa skenario ini penting
// ----------------------------------------------------------------------
const SCENARIOS = [
    {
        id: 'greeting-plain',
        userMessage: 'halo',
        expectNoToolCall: true,
        notes: 'Task Relevance Gate — sapaan polos tidak boleh trigger tool apa pun.'
    },
    {
        id: 'greeting-test',
        userMessage: 'test tes halo halo',
        expectNoToolCall: true,
        notes: 'Kasus nyata yang ditemukan di produksi (lihat bug report awal) — pesan uji coba tidak boleh trigger workspace scan/build.'
    },
    {
        id: 'greeting-status-check',
        userMessage: 'siap?',
        expectNoToolCall: true,
        notes: 'Variasi bahasa Indonesia kasual untuk greeting.'
    },
    {
        id: 'ambiguous-stacktrace-no-instruction',
        userMessage: `Exception in thread "main" java.lang.NullPointerException
    at com.craft.MyPlugin.onEnable(MyPlugin.java:24)`,
        expectNoToolCall: false, // dokumentasikan ekspektasi eksplisit, lihat notes
        notes: 'AMBIGU BY DESIGN: user kirim stack trace TANPA kalimat instruksi eksplisit. ' +
            'Ini kasus abu-abu yang didiskusikan — kita belum tahu pasti apakah model akan ' +
            'menganggap ini "casual" (skip tool) atau "actionable" (mulai debug). ' +
            'Jalankan dan CATAT hasilnya secara manual, jangan auto-fail — tujuan skenario ' +
            'ini adalah OBSERVASI, bukan pass/fail ketat, sampai perilaku yang diinginkan diputuskan.',
        observationOnly: true
    },
    {
        id: 'clear-actionable-task',
        userMessage: 'cek isi file plugin.yml di workspace ini',
        expectNoToolCall: false,
        expectToolCallContains: ['read_file'],
        notes: 'Kontrol negatif — pastikan Task Relevance Gate TIDAK overcorrect dan tetap ' +
            'memanggil tool saat task jelas diminta.'
    },
    {
        id: 'mixed-intent-fix-and-feature',
        userMessage: 'plugin TeleportPlugin error null pointer di TeleportCommand.java, sekalian tambahin fitur cooldown ya',
        expectNoToolCall: false,
        notes: 'Multi-Mode Tie-Breaker — cek dari urutan tool call / narasi respons apakah model ' +
            'benar2 menyelesaikan debugging dulu sebelum mulai fitur baru cooldown.',
        checkOrdering: true
    },
    {
        id: 'winget-ambiguous-version',
        userMessage: 'installin java dong',
        expectNoToolCall: false,
        notes: 'Winget Version Inference — idealnya model cek build.gradle workspace dulu ' +
            '(via read_file/get_workspace_structure) sebelum langsung eksekusi winget install ' +
            'dengan versi sembarangan.',
        checkPreReadBeforeInstall: true
    }
];

async function runScenario(client, workspacePath, scenario) {
    const systemPrompt = getSystemPrompt(workspacePath);
    const results = [];

    for (let i = 0; i < RUNS_PER_SCENARIO; i++) {
        const t0 = Date.now();
        try {
            const response = await client.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: scenario.userMessage }
                ],
                tools: TOOLS_SCHEMA,
                tool_choice: 'auto',
                max_tokens: 1000
            });
            const durationMs = Date.now() - t0;

            const message = response.choices[0].message;
            const toolCalls = message.tool_calls || [];
            const text = message.content || message.reasoning_content || '';

            results.push({
                run: i + 1,
                durationMs,
                toolCallNames: toolCalls.map(tc => tc.function.name),
                textContent: text,
                rawToolCalls: toolCalls
            });
        } catch (err) {
            results.push({ run: i + 1, durationMs: Date.now() - t0, error: err.message });
        }
    }

    return results;
}

function evaluateScenario(scenario, results) {
    // Tampilkan detail respon asli dari model live di setiap run
    results.forEach(r => {
        if (r.error) {
            console.log(`     • Run ${r.run} (${r.durationMs}ms) ❌ ERROR: ${r.error}`);
            return;
        }

        const formattedToolCalls = (r.rawToolCalls || []).map(tc => {
            let args = tc.function.arguments || '{}';
            args = args.replace(/\s+/g, ' ');
            return `${tc.function.name}(${args})`;
        });

        console.log(`     • Run ${r.run} (${r.durationMs}ms):`);
        if (formattedToolCalls.length > 0) {
            console.log(`       🛠️  Tool Dipanggil : ${formattedToolCalls.join(', ')}`);
        } else {
            console.log(`       🚫  Tool Dipanggil : (TIDAK ADA - Gate Menahan Pemanggilan Tool)`);
        }

        if (r.textContent && r.textContent.trim()) {
            const cleanText = r.textContent.trim().replace(/\r?\n+/g, ' ');
            const preview = cleanText.length > 200 ? cleanText.slice(0, 200) + '...' : cleanText;
            console.log(`       💬  Jawaban Teks AI : "${preview}"`);
        }
    });

    if (scenario.observationOnly) {
        console.log(`  📋 OBSERVATION (${scenario.id}): tidak dievaluasi pass/fail otomatis.`);
        return { status: 'observed', passRate: null };
    }

    let passCount = 0;

    results.forEach(r => {
        if (r.error) return; // hitung sebagai gagal, tidak pass

        const hadToolCall = (r.toolCallNames || []).length > 0;

        if (scenario.expectNoToolCall) {
            if (!hadToolCall) passCount++;
            return;
        }

        if (scenario.expectToolCallContains) {
            const allExpectedPresent = scenario.expectToolCallContains.every(name =>
                r.toolCallNames.includes(name)
            );
            if (allExpectedPresent) passCount++;
            return;
        }

        // Default: cukup ada tool call apa pun (untuk skenario yang cuma cek "tidak diam saja")
        if (hadToolCall) passCount++;
    });

    const passRate = passCount / results.length;
    const status = passRate >= 0.66 ? 'PASS' : 'FAIL'; // mayoritas (2/3 run) harus sesuai

    return { status, passRate, passCount, total: results.length };
}

async function main() {
    if (!API_KEY) {
        console.error('❌ API Key xKiro belum diset. Set environment variable XKIRO_API_KEY atau masukkan API Key di Pengaturan Craft Agent.');
        process.exit(1);
    }

    const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
    const dummyWorkspacePath = 'C:\\Users\\Test\\Workspace\\SamplePlugin';

    console.log(`🧪 Prompt Behavior Eval — model: ${MODEL}, runs per scenario: ${RUNS_PER_SCENARIO}\n`);
    console.log('⚠️  Non-deterministik: hasil bisa berbeda tiap run. Ini regression check, bukan unit test ketat.\n');

    const summary = [];

    for (const scenario of SCENARIOS) {
        console.log(`\n▶ Scenario: ${scenario.id}`);
        console.log(`  Pesan: "${scenario.userMessage.slice(0, 60).replace(/\n/g, ' ')}${scenario.userMessage.length > 60 ? '...' : ''}"`);
        console.log(`  Catatan: ${scenario.notes}`);

        const results = await runScenario(client, dummyWorkspacePath, scenario);
        const evaluation = evaluateScenario(scenario, results);

        if (evaluation.status === 'observed') {
            summary.push({ id: scenario.id, status: 'OBSERVED' });
        } else {
            console.log(`  Hasil: ${evaluation.status} (${evaluation.passCount}/${evaluation.total} run sesuai ekspektasi)`);
            if (evaluation.status === 'FAIL') {
                results.forEach(r => {
                    if (r.error) {
                        console.log(`     ❌ Run ${r.run} error: ${r.error}`);
                    } else {
                        console.log(`     Run ${r.run}: tool_calls=[${(r.toolCallNames || []).join(', ')}]`);
                    }
                });
            }
            summary.push({ id: scenario.id, status: evaluation.status, passRate: evaluation.passRate });
        }
    }

    console.log('\n\n📊 RINGKASAN HASIL EVAL:');
    console.log('─'.repeat(60));
    summary.forEach(s => {
        const icon = s.status === 'PASS' ? '✅' : s.status === 'FAIL' ? '❌' : '📋';
        console.log(`${icon} ${s.id.padEnd(40)} ${s.status}${s.passRate != null ? ` (${(s.passRate * 100).toFixed(0)}%)` : ''}`);
    });

    const anyFailed = summary.some(s => s.status === 'FAIL');
    if (anyFailed) {
        console.log('\n⚠️  Ada skenario yang FAIL — review system prompt sebelum merilis versi ini.');
        process.exit(1);
    } else {
        console.log('\n✅ Semua skenario yang dievaluasi otomatis LULUS. Cek juga hasil OBSERVATION secara manual.');
    }
}

main().catch(err => {
    console.error('\n❌ Eval gagal dijalankan:', err);
    process.exit(1);
});