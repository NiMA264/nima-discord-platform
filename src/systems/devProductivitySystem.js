const { OpenAI } = require('openai');
const { truncateText } = require('../utils/message');
const { formatError, aiError } = require('../utils/logger');
const { formatFocusLabel, getDevFormattingStats } = require('../utils/devFormatting');
const { logOptimizeTelemetry } = require('../utils/aiTelemetry');

const MAX_DEV_CODE_LENGTH = 3500;
const MAX_DEBUG_ERROR_INPUT_LENGTH = 3500;
const MIN_REVIEW_CODE_LENGTH = 20;
const MIN_OPTIMIZE_CODE_LENGTH = 20;

function sanitizeCodeInput(code) {
    let value = String(code || '');
    value = value.replace(/(sk-[a-zA-Z0-9]{12,})/g, '[REDACTED_KEY]');
    value = value.replace(/(api[_-]?key\s*[:=]\s*)(["'`]?)[^"'`\n]+/gi, '$1$2[REDACTED]');
    value = value.replace(/(token\s*[:=]\s*)(["'`]?)[^"'`\n]+/gi, '$1$2[REDACTED]');
    return value.trim();
}

function validateCodeLength(code) {
    const value = String(code || '');
    if (!value.trim()) {
        return { ok: false, code: 'empty-code', message: 'Bitte Code angeben.' };
    }
    if (value.length > MAX_DEV_CODE_LENGTH) {
        return { ok: false, code: 'code-too-long', message: `Code zu lang. Maximal ${MAX_DEV_CODE_LENGTH} Zeichen erlaubt.` };
    }
    return { ok: true };
}

function validateDebugInputLength(errorText, code, context) {
    const totalLength = String(errorText || '').length + String(code || '').length + String(context || '').length;
    if (totalLength > MAX_DEBUG_ERROR_INPUT_LENGTH) {
        return {
            ok: false,
            code: 'debug-input-too-long',
            message: `Input zu lang. error + code + context duerfen zusammen maximal ${MAX_DEBUG_ERROR_INPUT_LENGTH} Zeichen haben.`
        };
    }
    return { ok: true };
}

function getAiClient(config, deps = {}) {
    if (deps.aiClient) return deps.aiClient;
    const enabled = Boolean(config?.ai?.enabled);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!enabled || !apiKey) return null;
    return new OpenAI({ apiKey });
}

function buildExplainPrompt({ code, language, goal }) {
    return [
        'Erklaere den folgenden Code fuer Entwickler.',
        'Antworte kompakt mit: 1) Kurz-Erklaerung 2) Risiken/Bugs 3) Verbesserungen.',
        'Keine erfundenen Annahmen und keine Aussagen ueber Ausfuehrungstests.',
        language ? `Language: ${language}` : null,
        goal ? `Goal: ${goal}` : null,
        `Code:\n${code}`
    ].filter(Boolean).join('\n');
}

function buildReviewPrompt({ code, language, focus }) {
    return [
        'Fuehre ein strukturiertes Code-Review durch.',
        `Focus: ${formatFocusLabel(focus || 'all')}`,
        'Liefere Findings priorisiert als: critical, warning, suggestion.',
        'Gib konkrete Aenderungsvorschlaege. Keine erfundenen Abhaengigkeiten.',
        'Keine Aussage, dass Code ausgefuehrt/getestet wurde.',
        language ? `Language: ${language}` : null,
        `Code:\n${code}`
    ].filter(Boolean).join('\n');
}

function buildGenerateTestsPrompt({ code, language, framework }) {
    return [
        'Erzeuge einen kompakten Testplan oder Testcode fuer den folgenden Code.',
        'Strukturiere nach: Happy Path, Edge Cases, Error Cases.',
        framework ? `Framework: ${framework}` : 'Framework: not specified',
        language ? `Language: ${language}` : null,
        'Keine Behauptung, dass Tests bereits ausgefuehrt wurden.',
        `Code:\n${code}`
    ].filter(Boolean).join('\n');
}

function buildDebugErrorPrompt({ error, code, language, context }) {
    return [
        'Analysiere die Fehlermeldung und liefere eine kompakte Debug-Einschaetzung.',
        'Strukturiere mit genau diesen Sections:',
        '### Likely Cause',
        '### Fix Steps',
        '### Check Next',
        '### Missing Context',
        'Kein Code ausfuehren. Keine Behauptung ueber getestete Ergebnisse. Keine erfundenen Dateien oder Logs.',
        language ? `Language: ${language}` : null,
        `Error/Stacktrace:\n${error}`,
        code ? `Code (optional):\n${code}` : null,
        context ? `Context (optional):\n${context}` : 'Context (optional): not provided'
    ].filter(Boolean).join('\n');
}

function buildOptimizePrompt({ code, language, goal }) {
    return [
        'Analysiere den Code auf Optimierungspotenzial.',
        'Liefere konkrete, pragmatische Verbesserungen.',
        'Strukturiere mit genau diesen Sections:',
        '### Quick Wins',
        '### Refactor Suggestions',
        '### Risk Notes',
        '### Example Rewrite',
        'Keine Benchmarks erfinden. Keine Behauptung ueber Ausfuehrung oder Messung.',
        language ? `Language: ${language}` : null,
        `Goal: ${goal || 'all'}`,
        `Code:\n${code}`
    ].filter(Boolean).join('\n');
}

async function completeWithAi(config, prompt, fallbackText, deps = {}) {
    const aiClient = getAiClient(config, deps);
    if (!aiClient) {
        return { ok: true, text: fallbackText, fallback: true };
    }

    try {
        const model = config?.ai?.model || 'gpt-4.1-mini';
        const response = await aiClient.responses.create({
            model,
            input: [
                {
                    role: 'system',
                    content: 'Du bist ein praeziser Senior Engineer Assistant. Antworte knapp, strukturiert, technisch.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });
        const text = truncateText(String(response.output_text || '').trim(), 5000);
        if (!text) {
            return { ok: true, text: fallbackText, fallback: true };
        }
        return { ok: true, text, fallback: false };
    } catch (err) {
        aiError('dev productivity AI generation failed', { error: formatError(err) });
        return { ok: true, text: fallbackText, fallback: true, error: true };
    }
}

async function handleDevExplain(config, options, deps = {}) {
    const check = validateCodeLength(options.code);
    if (!check.ok) return check;
    const cleanCode = sanitizeCodeInput(options.code);
    const prompt = buildExplainPrompt({ ...options, code: cleanCode });
    const fallback = [
        'AI-Antwort momentan nicht verfuegbar.',
        'Kurz-Hinweis:',
        '- Beschreibe Zweck, Inputs/Outputs, Seiteneffekte.',
        '- Pruefe Null/Undefined-Pfade, Fehlerbehandlung, Randfaelle.',
        '- Isoliere Logik in kleine testbare Funktionen.'
    ].join('\n');
    const completion = await completeWithAi(config, prompt, fallback, deps);
    return {
        ok: true,
        title: 'Dev Explain',
        text: completion.text
    };
}

async function handleDevReview(config, options, deps = {}) {
    const check = validateCodeLength(options.code);
    if (!check.ok) return check;
    if (String(options.code || '').trim().length < MIN_REVIEW_CODE_LENGTH) {
        return {
            ok: true,
            title: `Dev Review (${formatFocusLabel(options.focus || 'all')})`,
            text: 'Der Code ist zu kurz fuer ein sinnvolles Review.'
        };
    }
    const cleanCode = sanitizeCodeInput(options.code);
    const prompt = buildReviewPrompt({ ...options, code: cleanCode });
    const fallback = [
        'AI-Review aktuell nicht verfuegbar.',
        'Review-Template:',
        'critical: Sicherheitsluecken, Datenverlust, Absturzrisiken',
        'warning: Logik-/Performance-Probleme',
        'suggestion: Lesbarkeit, API-Klarheit, Refactoring'
    ].join('\n');
    const completion = await completeWithAi(config, prompt, fallback, deps);
    return {
        ok: true,
        title: `Dev Review (${formatFocusLabel(options.focus || 'all')})`,
        text: completion.text
    };
}

async function handleDevGenerateTests(config, options, deps = {}) {
    const check = validateCodeLength(options.code);
    if (!check.ok) return check;
    const cleanCode = sanitizeCodeInput(options.code);
    const prompt = buildGenerateTestsPrompt({ ...options, code: cleanCode });
    const fallback = [
        'AI-Testgenerierung aktuell nicht verfuegbar.',
        'Mindest-Testplan:',
        '1. Happy Path',
        '2. Edge Cases',
        '3. Error Cases'
    ].join('\n');
    const completion = await completeWithAi(config, prompt, fallback, deps);
    return {
        ok: true,
        title: 'Dev Generate Tests',
        text: completion.text
    };
}

async function handleDevDebugError(config, options, deps = {}) {
    const errorText = String(options.error || '').trim();
    if (!errorText) {
        return { ok: false, code: 'empty-error', message: 'Bitte error angeben.' };
    }

    const inputLength = validateDebugInputLength(options.error, options.code, options.context);
    if (!inputLength.ok) return inputLength;

    const cleanError = sanitizeCodeInput(options.error);
    const cleanCode = sanitizeCodeInput(options.code || '');
    const cleanContext = sanitizeCodeInput(options.context || '');
    const prompt = buildDebugErrorPrompt({
        error: cleanError,
        code: cleanCode,
        language: options.language,
        context: cleanContext
    });

    const fallback = [
        '### Likely Cause',
        'Die Ursache laesst sich ohne vollstaendigen Kontext nur teilweise abschaetzen.',
        '### Fix Steps',
        '1. Isoliere die fehlschlagende Stelle anhand der ersten relevanten Stacktrace-Zeile.',
        '2. Pruefe Eingabeparameter, null/undefined und Typannahmen.',
        '3. Ergaenze Guards und gezielte Fehlerbehandlung.',
        '### Check Next',
        '- Reproduzierbarer Minimalfall',
        '- Exakte Runtime/Versionen',
        '- Vorheriger Commit/letzte Aenderung',
        '### Missing Context',
        cleanContext ? 'n/a' : 'Es fehlen reproduzierbare Schritte und relevanter Codeausschnitt.'
    ].join('\n');

    const completion = await completeWithAi(config, prompt, fallback, deps);
    return {
        ok: true,
        title: 'Dev Debug Error',
        text: completion.text
    };
}

async function handleDevOptimize(config, options, deps = {}) {
    const startedAt = typeof deps.now === 'function' ? deps.now() : Date.now();
    const telemetryLogger = deps.telemetryLogger || logOptimizeTelemetry;
    const promptVersion = config?.ai?.optimizePromptVersion || 'v1.0.0';
    const baseTelemetry = {
        timestamp: new Date().toISOString(),
        promptVersion,
        goal: options.goal || 'all',
        language: options.language || '',
        inputLength: String(options.code || '').length
    };

    const check = validateCodeLength(options.code);
    if (!check.ok) {
        await telemetryLogger({
            ...baseTelemetry,
            outputLength: 0,
            truncated: false,
            fallbackUsed: false,
            durationMs: (typeof deps.now === 'function' ? deps.now() : Date.now()) - startedAt,
            success: false
        });
        return check;
    }
    if (String(options.code || '').trim().length < MIN_OPTIMIZE_CODE_LENGTH) {
        const shortText = 'Der Code ist zu kurz fuer eine sinnvolle Optimierung.';
        await telemetryLogger({
            ...baseTelemetry,
            outputLength: shortText.length,
            truncated: false,
            fallbackUsed: false,
            durationMs: (typeof deps.now === 'function' ? deps.now() : Date.now()) - startedAt,
            success: true
        });
        return {
            ok: true,
            title: `Dev Optimize (${options.goal || 'all'})`,
            text: shortText
        };
    }

    const cleanCode = sanitizeCodeInput(options.code);
    const prompt = buildOptimizePrompt({
        code: cleanCode,
        language: options.language,
        goal: options.goal || 'all'
    });

    const fallback = [
        '### Quick Wins',
        '- Reduziere unnötige Wiederholungen und extrahiere Hilfsfunktionen.',
        '### Refactor Suggestions',
        '- Trenne Datenzugriff, Business-Logik und Präsentation klar.',
        '### Risk Notes',
        '- Achte auf Verhaltensänderungen bei Refactors ohne Tests.',
        '### Example Rewrite',
        '- Zeige zuerst kleine, sichere Umbauten bevor große Architekturänderungen folgen.'
    ].join('\n');

    const completion = await completeWithAi(config, prompt, fallback, deps);
    const outputText = completion.text || '';
    const formattingStats = getDevFormattingStats(outputText);
    await telemetryLogger({
        ...baseTelemetry,
        outputLength: outputText.length,
        truncated: Boolean(formattingStats.truncated),
        fallbackUsed: Boolean(completion.fallback),
        durationMs: (typeof deps.now === 'function' ? deps.now() : Date.now()) - startedAt,
        success: !completion.error
    });
    return {
        ok: true,
        title: `Dev Optimize (${options.goal || 'all'})`,
        text: outputText
    };
}

module.exports = {
    MAX_DEV_CODE_LENGTH,
    MAX_DEBUG_ERROR_INPUT_LENGTH,
    MIN_REVIEW_CODE_LENGTH,
    MIN_OPTIMIZE_CODE_LENGTH,
    sanitizeCodeInput,
    validateCodeLength,
    validateDebugInputLength,
    buildExplainPrompt,
    buildReviewPrompt,
    buildGenerateTestsPrompt,
    buildDebugErrorPrompt,
    buildOptimizePrompt,
    handleDevExplain,
    handleDevReview,
    handleDevGenerateTests,
    handleDevDebugError,
    handleDevOptimize
};
