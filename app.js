'use strict';
/* =============================================================================
   ClearCite — app.js
   1 Constants · 2 Pure helpers · 3 Formatters · 4 Verdict · 5 State
   6 Renderers · 7 Storage · 8 Events · 9 Init
   No top-level DOM access: everything happens inside init().
   ============================================================================= */

/* 0 ------------------------------------------------------------------ i18n */

var TRANSLATIONS = (typeof window !== 'undefined' && window.CC_I18N) || {};
var LANG = 'en';
var COUNT_PATTERNS = {
  'zh-Hans': [/^(\d+) saved$/, '$1 条已保存'],
  'zh-Hant': [/^(\d+) saved$/, '$1 條已儲存'],
  fr: [/^(\d+) saved$/, '$1 enregistrée(s)'],
  es: [/^(\d+) saved$/, '$1 guardada(s)']
};
function tr(value) {
  if (typeof value !== 'string' || LANG === 'en') return value;
  var map = TRANSLATIONS[LANG];
  if (map && map[value]) return map[value];
  var p = COUNT_PATTERNS[LANG];
  if (p) {
    var m = p[0].exec(value);
    if (m) return p[1].replace('$1', m[1]);
  }
  return value;
}
function trSpaced(value) {
  var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!m || !m[2]) return value;
  var core = m[2], out = tr(core);
  if (out === core) {
    var collapsed = core.replace(/\s+/g, ' ');
    if (collapsed !== core) out = tr(collapsed);
  }
  return m[1] + out + m[3];
}
/* Keeps the English source on each node so switching languages is reversible. */
function translateDom(root) {
  if (!root || !root.nodeType) return;
  if (root.nodeType === 1) translateElement(root);
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    var parent = node.parentNode;
    if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') return;
    if (node.__ccEn === undefined) node.__ccEn = node.nodeValue;
    var next = trSpaced(node.__ccEn);
    if (node.nodeValue !== next) node.nodeValue = next;
  });
  if (root.nodeType === 1) {
    var kids = root.querySelectorAll('*');
    Array.prototype.forEach.call(kids, translateElement);
  }
}
function translateElement(el) {
  ['placeholder', 'aria-label', 'title'].forEach(function (attr) {
    if (!el.hasAttribute) return;
    if (!el.hasAttribute(attr)) return;
    var store = '__ccEn_' + attr.replace('-', '_');
    if (el[store] === undefined) el[store] = el.getAttribute(attr);
    var next = tr(el[store]);
    if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
  });
}
function showPolicyLangNote() {
  var note = document.getElementById('policy-lang-note');
  if (!note) return;
  note.hidden = LANG === 'en';
  note.textContent = LANG === 'en' ? '' : tr('Policy excerpts are quoted in English from the official sources.');
}
function applyLanguage(code) {
  LANG = TRANSLATIONS[code] ? code : 'en';
  document.documentElement.lang = LANG;
  if (els.lang) els.lang.value = LANG;
  renderVerdict();
  renderOutputs();
  renderList();
  renderSetup();
  translateDom(document.body);
  showPolicyLangNote();
  savePrefs();
}

/* 1 --------------------------------------------------------------- Constants */

var PROGRAMS = [
  { id: 'ib',  label: 'IB',      full: 'International Baccalaureate',        note: 'Diploma & CP coursework, EE, TOK, IA' },
  { id: 'ap',  label: 'AP®',     full: 'Advanced Placement (College Board)', note: 'Capstone, Art & Design, CSP, world languages' },
  { id: 'bc',  label: 'BC',      full: 'BC Curriculum (K–12)',               note: 'BC graduation program, Capstone, ADST' },
  { id: 'gen', label: 'General', full: 'General Canada / US',                note: 'District or school-level academic integrity policy' }
];

var COURSE_PLAN = {
  ib: [
    { label: '', items: [{ id: 'ib-general', label: 'General / Interdisciplinary — no specific subject group', lens: 'general' }] },
    { label: 'Group 1 · Studies in Language and Literature', items: [
      { id: 'ib-g1-lit', label: 'English A: Literature', lens: 'lang-lit' },
      { id: 'ib-g1-lal', label: 'English A: Language and Literature', lens: 'lang-lit' },
      { id: 'ib-g1-litperf', label: 'Literature and Performance', lens: 'lang-lit' }
    ] },
    { label: 'Group 2 · Language Acquisition', items: [
      { id: 'ib-g2-b', label: 'Language B (French, Spanish, Mandarin…)', lens: 'lang-acq' },
      { id: 'ib-g2-ab', label: 'Language ab initio', lens: 'lang-acq' },
      { id: 'ib-g2-class', label: 'Classical languages (Latin, Greek)', lens: 'lang-acq' }
    ] },
    { label: 'Group 3 · Individuals and Societies', items: [
      { id: 'ib-g3-hist', label: 'History', lens: 'humanities' },
      { id: 'ib-g3-psych', label: 'Psychology', lens: 'humanities' },
      { id: 'ib-g3-econ', label: 'Economics', lens: 'humanities' },
      { id: 'ib-g3-geo', label: 'Geography', lens: 'humanities' },
      { id: 'ib-g3-glopol', label: 'Global Politics', lens: 'humanities' },
      { id: 'ib-g3-phil', label: 'Philosophy', lens: 'humanities' },
      { id: 'ib-g3-bm', label: 'Business Management', lens: 'humanities' },
      { id: 'ib-g3-ess', label: 'Environmental Systems and Societies', lens: 'stem' }
    ] },
    { label: 'Group 4 · Sciences', items: [
      { id: 'ib-g4-bio', label: 'Biology', lens: 'stem' },
      { id: 'ib-g4-chem', label: 'Chemistry', lens: 'stem' },
      { id: 'ib-g4-phys', label: 'Physics', lens: 'stem' },
      { id: 'ib-g4-sehs', label: 'Sports, Exercise and Health Science', lens: 'stem' },
      { id: 'ib-g4-cs', label: 'Computer Science', lens: 'cs' }
    ] },
    { label: 'Group 5 · Mathematics', items: [
      { id: 'ib-g5-aa', label: 'Mathematics: Analysis and Approaches', lens: 'stem' },
      { id: 'ib-g5-ai', label: 'Mathematics: Applications and Interpretation', lens: 'stem' }
    ] },
    { label: 'Group 6 · The Arts', items: [
      { id: 'ib-g6-va', label: 'Visual Arts', lens: 'arts' },
      { id: 'ib-g6-music', label: 'Music', lens: 'arts' },
      { id: 'ib-g6-theatre', label: 'Theatre', lens: 'arts' },
      { id: 'ib-g6-film', label: 'Film', lens: 'arts' },
      { id: 'ib-g6-dance', label: 'Dance', lens: 'arts' }
    ] },
    { label: 'DP core', items: [
      { id: 'ib-core-tok', label: 'Theory of Knowledge', lens: 'humanities' },
      { id: 'ib-core-ee', label: 'Extended Essay', lens: 'humanities' },
      { id: 'ib-core-cas', label: 'Creativity, Activity, Service', lens: 'careers' }
    ] }
  ],
  ap: [
    { label: '', items: [{ id: 'ap-general', label: 'General / Interdisciplinary — no specific subject group', lens: 'general' }] },
    { label: 'AP Capstone', items: [
      { id: 'ap-capstone-sem', label: 'AP Seminar', lens: 'humanities' },
      { id: 'ap-capstone-res', label: 'AP Research', lens: 'humanities' }
    ] },
    { label: 'AP Arts', items: [
      { id: 'ap-art-2d', label: 'AP Art and Design: 2-D', lens: 'arts' },
      { id: 'ap-art-3d', label: 'AP Art and Design: 3-D', lens: 'arts' },
      { id: 'ap-art-draw', label: 'AP Art and Design: Drawing', lens: 'arts' }
    ] },
    { label: 'AP English', items: [
      { id: 'ap-eng-lang', label: 'AP English Language and Composition', lens: 'lang-lit' },
      { id: 'ap-eng-lit', label: 'AP English Literature and Composition', lens: 'lang-lit' }
    ] },
    { label: 'AP History and Social Sciences', items: [
      { id: 'ap-hug', label: 'Human Geography', lens: 'humanities' },
      { id: 'ap-world', label: 'World History: Modern', lens: 'humanities' },
      { id: 'ap-us-history', label: 'United States History', lens: 'humanities' },
      { id: 'ap-euro', label: 'European History', lens: 'humanities' },
      { id: 'ap-psych', label: 'Psychology', lens: 'humanities' },
      { id: 'ap-afam', label: 'African American Studies', lens: 'humanities' },
      { id: 'ap-gov', label: 'U.S. Government and Politics', lens: 'humanities' },
      { id: 'ap-econ', label: 'Microeconomics / Macroeconomics', lens: 'humanities' }
    ] },
    { label: 'AP Mathematics', items: [
      { id: 'ap-calc-ab', label: 'Calculus AB', lens: 'stem' },
      { id: 'ap-calc-bc', label: 'Calculus BC', lens: 'stem' },
      { id: 'ap-stats', label: 'Statistics', lens: 'stem' }
    ] },
    { label: 'AP Computer Science', items: [
      { id: 'ap-csp', label: 'Computer Science Principles', lens: 'cs' },
      { id: 'ap-csa', label: 'Computer Science A', lens: 'cs' }
    ] },
    { label: 'AP Sciences', items: [
      { id: 'ap-bio', label: 'Biology', lens: 'stem' },
      { id: 'ap-chem', label: 'Chemistry', lens: 'stem' },
      { id: 'ap-phys1', label: 'Physics 1', lens: 'stem' },
      { id: 'ap-phys2', label: 'Physics 2', lens: 'stem' },
      { id: 'ap-physc', label: 'Physics C: Mechanics / E&M', lens: 'stem' },
      { id: 'ap-env', label: 'Environmental Science', lens: 'stem' }
    ] },
    { label: 'AP World Languages and Cultures', items: [
      { id: 'ap-french', label: 'French Language and Culture', lens: 'lang-acq' },
      { id: 'ap-spanish', label: 'Spanish Language and Culture', lens: 'lang-acq' },
      { id: 'ap-german', label: 'German Language and Culture', lens: 'lang-acq' },
      { id: 'ap-italian', label: 'Italian Language and Culture', lens: 'lang-acq' },
      { id: 'ap-chinese', label: 'Chinese Language and Culture', lens: 'lang-acq' },
      { id: 'ap-japanese', label: 'Japanese Language and Culture', lens: 'lang-acq' }
    ] }
  ],
  bc: [
    { label: '', items: [{ id: 'bc-general', label: 'General / Interdisciplinary — no specific subject group', lens: 'general' }] },
    { label: 'English Language Arts', items: [{ id: 'bc-ela', label: 'English Language Arts', lens: 'lang-lit' }] },
    { label: 'Languages', items: [
      { id: 'bc-lang-fr', label: 'French', lens: 'lang-acq' },
      { id: 'bc-lang-es', label: 'Spanish', lens: 'lang-acq' },
      { id: 'bc-lang-zh', label: 'Mandarin', lens: 'lang-acq' }
    ] },
    { label: 'Social Studies', items: [{ id: 'bc-ss', label: 'Social Studies', lens: 'humanities' }] },
    { label: 'Mathematics', items: [{ id: 'bc-math', label: 'Mathematics', lens: 'stem' }] },
    { label: 'Science', items: [{ id: 'bc-sci', label: 'Science', lens: 'stem' }] },
    { label: 'Arts Education', items: [{ id: 'bc-arts', label: 'Arts Education', lens: 'arts' }] },
    { label: 'Applied Design, Skills and Technologies', items: [{ id: 'bc-adst', label: 'ADST', lens: 'cs' }] },
    { label: 'Career Education', items: [
      { id: 'bc-careers', label: 'Career-Life Connections', lens: 'careers' },
      { id: 'bc-capstone', label: 'Capstone', lens: 'careers' }
    ] }
  ],
  gen: [
    { label: '', items: [{ id: 'gen-general', label: 'General / Interdisciplinary — no specific subject group', lens: 'general' }] },
    { label: 'Subjects', items: [
      { id: 'gen-eng', label: 'English', lens: 'lang-lit' },
      { id: 'gen-lang', label: 'Languages', lens: 'lang-acq' },
      { id: 'gen-hum', label: 'Humanities and Social Sciences', lens: 'humanities' },
      { id: 'gen-sci', label: 'Sciences', lens: 'stem' },
      { id: 'gen-math', label: 'Mathematics', lens: 'stem' },
      { id: 'gen-cs', label: 'Computer Science', lens: 'cs' },
      { id: 'gen-arts', label: 'Arts', lens: 'arts' },
      { id: 'gen-careers', label: 'Career / Co-op', lens: 'careers' }
    ] }
  ]
};

var COURSES = [];
var COURSE_INDEX = {};
Object.keys(COURSE_PLAN).forEach(function (p) {
  COURSE_PLAN[p].forEach(function (g) {
    g.items.forEach(function (c) {
      c.program = p; c.group = g.label; c.short = c.label;
      COURSE_INDEX[c.id] = c;
      COURSES.push(c);
    });
  });
});
function lensOfCourse(id) { return (COURSE_INDEX[id] && COURSE_INDEX[id].lens) || 'general'; }
function defaultCourse(program) {
  var groups = COURSE_PLAN[program] || COURSE_PLAN.gen;
  return groups[0].items[0].id;
}

var LENS = {
  general: "Your teacher's assignment instructions override every default in this tool.",
  'lang-lit': 'Literary analysis must be yours. AI-suggested quotations are frequently misquoted or invented — verify every line against the text.',
  'lang-acq': 'Marks are awarded for language. AI translation and sentence-level rewriting are treated as misconduct in IB and are restricted in AP world language tasks.',
  humanities: 'Research questions, reflections and source selection carry the most risk here. Teacher checkpoints and verified sources matter more than polished prose.',
  stem: 'Concept explanations and debugging are usually fine with disclosure. Data, calculations, error analysis and conclusions must be yours.',
  cs: 'Debugging and concept help are allowed if you can explain every line. Undisclosed generated code is not.',
  arts: 'Generative AI belongs in research, ideation and experimentation. It cannot produce your submitted artwork.',
  careers: 'Authentic personal reflection, privacy and process evidence are the core of this course.'
};

var STRICTNESS = [
  { id: 'conservative', label: 'Conservative', blurb: 'Cite only what you actually reproduced.' },
  { id: 'mixed',        label: 'Mixed',        blurb: 'Policy default for IB, AP and BC.' },
  { id: 'aggressive',   label: 'Aggressive',   blurb: 'Cite every interaction, including brainstorming.' }
];

var CONTEXT_SURVEY = [
  { id: 'a1', q: 'Is this a summative or graded assessment?',
    why: 'Graded work is judged more strictly than practice.' },
  { id: 'a2', q: 'Does this task award marks for spelling, grammar, sentence structure or fluency?',
    why: 'If language is assessed, a language tool changes the mark, not just the wording.' },
  { id: 'a3', q: 'Have you told your teacher about this AI use — or will you before you submit?',
    why: 'Telling your teacher is expected whenever AI is used in submitted work.' },
  { id: 'a4', when: 'bc', q: 'Did you keep personal information out of the tool?',
    why: 'Do not enter names, student numbers or information about other people.' },
  { id: 'a5', when: 'ap', q: 'Have you completed the required checkpoints and kept your process evidence?',
    why: 'Checkpoints are required to receive a score on an AP performance task.' }
];

var SURVEY = [
  { id: 'b1', title: 'Getting started',
    desc: 'How you found your topic, your question and your sources. These are questions about what you did, not a test — nothing here is recorded or sent.',
    items: [
      { id: 'i1', q: 'Did AI help you find a topic, an angle, or opposing views?',
        why: 'You used it to widen the options, then researched and wrote the work yourself.',
        eg: 'Brainstorming essay topics · asking for counter-arguments to test your position' },
      { id: 'i2', q: 'Did AI suggest a structure, outline, or template?',
        why: 'A plan you then wrote from, rather than prose you kept.',
        eg: 'A five-paragraph outline · a checklist of sections for a report' },
      { id: 'r5', q: 'Did AI propose the research question you submitted?',
        why: 'The question came from the tool, without your teacher or supervisor shaping it.',
        eg: 'Pasting the assignment brief and asking for a question · asking AI to “narrow my topic” and keeping the result' },
      { id: 'r4', q: 'Did you use a quotation or reference you had not opened and read?',
        why: 'AI can invent sources, misquote real ones, or attach a quotation to the wrong page.',
        eg: 'Citing a book the tool named but you never opened · using a quotation without checking it in the text' }
    ] },
  { id: 'b2', title: 'Working on your draft',
    desc: 'What the tool did to your writing, and what you did with what it gave you.',
    items: [
      { id: 'r1', q: 'Did AI write sentences or paragraphs that you present as your own?',
        why: 'Copied, or reworded just enough that it no longer looks copied.',
        eg: 'Pasting an AI paragraph into your essay · asking for “a more academic version” and keeping it' },
      { id: 'r2', q: 'Did you put your own draft into AI and use what it wrote back?',
        why: 'Includes asking it to improve “flow”, “clarity” or “coherence”.',
        eg: 'Pasting your introduction and taking the stronger version · accepting rewritten topic sentences' },
      { id: 'i3', q: 'Did AI check your spelling, grammar, or tone?',
        why: 'Word- or sentence-level suggestions in a subject that does not award marks for language.',
        eg: 'A grammar check before submitting · asking whether the tone is too informal' },
      { id: 'r7', when: 'lang', q: 'Did AI help with grammar or sentence construction in this language course?',
        why: 'Marks are awarded for language here, so the tool is doing assessed work.',
        eg: 'Asking AI to correct your Spanish sentences · accepting reworded French' },
      { id: 'r6', q: 'Did AI translate your work, or part of it?',
        why: 'Includes writing in one language and translating the essay before submitting.',
        eg: 'Writing in Chinese, then translating to English · asking AI to “polish” a translation' },
      { id: 'r8', q: 'Did AI mark your draft or give you feedback for improvement?',
        why: 'On a summative task this competes with the one set of feedback your teacher is allowed to give.',
        eg: 'Asking AI to grade against the rubric · requesting improvement comments on a draft' },
      { id: 'i4', q: 'Did AI help you debug code or explain a concept?',
        why: 'You understand the final work and can explain every part of it yourself.',
        eg: 'Tracing an error message · asking what a theorem means before using it' }
    ] },
  { id: 'b3', title: 'What is in the final piece',
    desc: 'What a reader would find in the version you submit, including reflections and artwork.',
    items: [
      { id: 'd1', q: 'Does the final piece contain a direct quotation from AI?',
        why: 'Even one quoted sentence counts, and it needs quotation marks plus a citation.',
        eg: 'A quoted definition · a quoted sentence from the chat' },
      { id: 'd2', q: 'Did you paraphrase or adapt an AI explanation?',
        why: 'Close in structure or wording, even if not word for word.',
        eg: 'Rewording an AI summary of a theory · adapting its argument into your paragraph' },
      { id: 'd3', q: 'Does the final piece include an AI-generated image, diagram, table, or code?',
        why: 'Anything the tool produced that a reader will see or run.',
        eg: 'A generated diagram in a slide · AI-written code in a program · a table produced by the tool' },
      { id: 'r3', q: 'Did AI write a reflection that you submitted unchanged?',
        why: 'Extended essay RPPF, CAS, TOK, portfolio or capstone reflections.',
        eg: 'Asking AI to “reflect on my project” · using its paragraph as your RPPF' },
      { id: 'r9', when: 'arts', q: 'Is an AI-generated image part of the final artwork?',
        why: 'Generative output can support the process, but the submitted piece must be yours.',
        eg: 'A generated image in the portfolio · generative fill left in a final piece' }
    ] }
];
var SURVEY_IDS = {};
SURVEY.forEach(function (s) { s.items.forEach(function (it) { SURVEY_IDS[it.id] = 1; }); });

var CONTEXT_IDS = ['a1', 'a2', 'a3', 'a4', 'a5'];
var ALL_IDS = CONTEXT_IDS.concat(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'd1', 'd2', 'd3', 'i1', 'i2', 'i3', 'i4']);

var FLAGS = [
  { id: 'r1', hard: true, severity: { ib: 'prohibited', ap: 'prohibited', bc: 'prohibited', gen: 'prohibited' },
    refs: ['IB Scenario #5'], fix: 'Rewrite in your own words from your own notes, or quote and cite. If the argument is not yours, do not submit it.' },
  { id: 'r2', summative: true, severity: { ib: 'prohibited', ap: 'prohibited', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #7', 'IB Scenario #9'], fix: 'Submit the version you wrote. Keep the pre-AI draft as your evidence.' },
  { id: 'r3', severity: { ib: 'prohibited', ap: 'prohibited', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #11'], fix: 'Reflection must describe your own process. Replace it and keep dated planning notes.' },
  { id: 'r4', hard: true, refs: ['IB Scenario #3', 'MLA/APA/Chicago'],
    fix: 'Open the source, read it, verify the quotation word for word, then cite the source — not the chatbot.' },
  { id: 'r5', severity: { ib: 'prohibited', ap: 'context', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #4'], fix: 'Bring candidate questions to your supervisor. AI may generate examples only after you and your teacher have chosen the area.' },
  { id: 'r6', severity: { ib: 'prohibited', ap: 'context', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #8'], fix: 'Submit work written in the language of assessment. Translation is not your language performance.' },
  { id: 'r7', severity: { ib: 'prohibited', ap: 'context', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #8', 'IB Scenario #9'], fix: 'Marks are awarded for language here. Revert to your own sentences; a bilingual dictionary is not a rewriter.' },
  { id: 'r8', summative: true, severity: { ib: 'prohibited', ap: 'context', bc: 'context', gen: 'context' },
    refs: ['IB Scenario #10'], fix: 'The IB allows one set of written feedback from your teacher. Use AI feedback only on unassessed practice.' },
  { id: 'r9', only: 'arts', severity: { ib: 'prohibited', ap: 'prohibited', bc: 'context', gen: 'context' },
    refs: ['AP Art & Design', 'IB Visual Arts'], fix: 'Generative output cannot be your submitted artwork. Use it for ideation only and document the process.' }
];

var DIRECT_ITEMS = [
  { id: 'd1', contentType: 'quoted', phrase: 'quoted text' },
  { id: 'd2', contentType: 'paraphrased', phrase: 'an adapted explanation' },
  { id: 'd3', contentType: 'image', phrase: 'an AI image, chart or code' }
];
var INDIRECT_IDS = ['i1', 'i2', 'i3', 'i4'];
var PROGRAM_PROSE = { ib: 'the IB', ap: 'AP', bc: 'the BC curriculum', gen: "your school's policy" };

var LEVEL_META = {
  empty: { eyebrow: 'Verdict', icon: 'i-dashed', title: 'Nothing selected yet' },
  note: { eyebrow: 'No citation', icon: 'i-minus', title: 'No formal citation needed' },
  disclose: { eyebrow: 'Disclose', icon: 'i-lines', title: 'Allowed — disclose at the end' },
  context: { eyebrow: 'Conditional', icon: 'i-help', title: 'Check with your teacher first' },
  cite: { eyebrow: 'Cite in full', icon: 'i-quote', title: 'Allowed — cite it in full' },
  prohibited: { eyebrow: 'Not allowed', icon: 'i-ban', title: 'Not allowed as described' }
};

var HARNESS_GROUPS = [
  { id: 'app',     label: 'Official app / web' },
  { id: 'harness', label: 'Official harness (CLI, IDE)' },
  { id: 'third',   label: 'Third-party harness' },
  { id: 'agg',     label: 'Aggregator' }
];

var HARNESSES = [
  { id: 'chatgpt',  label: 'ChatGPT',        url: 'https://chatgpt.com',            group: 'app', fixed: 'GPT' },
  { id: 'claude',   label: 'Claude',         url: 'https://claude.ai',              group: 'app', fixed: 'Claude' },
  { id: 'gemini',   label: 'Gemini',         url: 'https://gemini.google.com',      group: 'app', fixed: 'Gemini' },
  { id: 'deepseek', label: 'DeepSeek',       url: 'https://chat.deepseek.com',      group: 'app', fixed: 'DeepSeek' },
  { id: 'grok',     label: 'Grok',           url: 'https://grok.com',               group: 'app', fixed: 'Grok' },
  { id: 'mistral-lechat', label: 'Le Chat (Mistral)', url: 'https://chat.mistral.ai', group: 'app', fixed: 'Mistral' },

  { id: 'codex',    label: 'OpenAI Codex',   url: 'https://openai.com/codex',       group: 'harness', fixed: '' },
  { id: 'claude-code', label: 'Claude Code', url: 'https://claude.ai',              group: 'harness', fixed: '' },
  { id: 'gemini-cli', label: 'Gemini CLI',   url: 'https://github.com/google-gemini/gemini-cli', group: 'harness', fixed: '' },
  { id: 'deepseek-harness', label: 'DeepSeek harness', url: 'https://chat.deepseek.com', group: 'harness', fixed: '' },
  { id: 'antigravity', label: 'Antigravity', url: 'https://antigravity.google',     group: 'harness', fixed: '' },
  { id: 'cursor',   label: 'Cursor',         url: 'https://cursor.com',             group: 'harness', fixed: '' },

  { id: 'workbuddy', label: 'WorkBuddy.ai',  url: 'https://workbuddy.ai',           group: 'third', fixed: '' },
  { id: 'hermes',   label: 'Hermes Agent',   url: '',                                group: 'third', fixed: '' },
  { id: 'openclawd', label: 'OpenClawd',     url: '',                                group: 'third', fixed: '' },
  { id: 'local',    label: 'Local / self-hosted', url: '',                           group: 'third', fixed: '' },

  { id: 'kagi',     label: 'Kagi AI',        url: 'https://kagi.com',               group: 'agg', fixed: '' },
  { id: 'copilot',  label: 'Microsoft Copilot', url: 'https://copilot.microsoft.com', group: 'agg', fixed: '' },
  { id: 'perplexity', label: 'Perplexity',   url: 'https://www.perplexity.ai',      group: 'agg', fixed: '' },
  { id: 'poe',      label: 'Poe',            url: 'https://poe.com',                group: 'agg', fixed: '' },
  { id: 'openrouter', label: 'OpenRouter',   url: 'https://openrouter.ai',          group: 'agg', fixed: '' },
  { id: 'other',    label: 'Other / custom', url: '',                                group: 'agg', fixed: '' }
];

var FAMILIES = [
  { id: 'Gemini', dev: 'Google' }, { id: 'GPT', dev: 'OpenAI' }, { id: 'Claude', dev: 'Anthropic' },
  { id: 'DeepSeek', dev: 'DeepSeek' }, { id: 'Qwen', dev: 'Alibaba Cloud' }, { id: 'Llama', dev: 'Meta' },
  { id: 'Mistral', dev: 'Mistral AI' }, { id: 'Grok', dev: 'xAI' }, { id: 'Midjourney', dev: 'Midjourney' },
  { id: 'DALL·E', dev: 'OpenAI' }, { id: 'Stable Diffusion', dev: 'Stability AI' },
  { id: 'Doubao', dev: 'ByteDance' }, { id: 'ERNIE', dev: 'Baidu' }, { id: 'Hunyuan', dev: 'Tencent' },
  { id: 'MiniMax', dev: 'MiniMax' }, { id: 'MiMo', dev: 'Xiaomi' }, { id: 'Nemotron', dev: 'NVIDIA' },
  { id: 'Muse', dev: '' }, { id: 'Inkling', dev: '' }, { id: 'Other', dev: '' }
];
var CUSTOM_FAMILIES = { Muse: 1, Inkling: 1, Other: 1 };
var HYPHEN_FAMILIES = { GPT: 1, DeepSeek: 1 };

var STYLES = [
  { id: 'mla', label: 'MLA 9' }, { id: 'apa', label: 'APA 7' },
  { id: 'chicagonb', label: 'Chicago 18 (N&B)' }, { id: 'chicagoad', label: 'Chicago 18 (A–D)' },
  { id: 'ib', label: 'IB' }
];
var DEFAULT_TAB = { ib: 'ib', ap: 'apa', bc: 'mla', gen: 'mla' };
var STYLE_HELP = {
  mla: 'MLA 9: the prompt becomes the title, the tool is the container, and the model sits in the version slot.',
  apa: 'APA 7: the developer is the author and the chat title is italicised. State the prompt in your text, not in the reference list.',
  chicagonb: 'Chicago 18: use a footnote. A bibliography entry is only added when a reader can open the link.',
  chicagoad: 'Chicago 18 author–date: put the prompt in your sentence and cite the model and date in parentheses.',
  ib: 'IB: quotation marks, the exact prompt and the generation date in the body, plus a bibliography entry.'
};
var TAB_HELP = {
  ib: 'IB requires the prompt and the date in the body of your work. This style gives you both.',
  ap: 'AP does not prescribe a style. APA is the most common choice; use whatever your teacher asks for.',
  bc: 'BC leaves the style to your teacher. MLA is the common default in English.',
  gen: 'Your assignment sheet decides the style. MLA is the safe default.'
};
var CONTENT_LABELS = {
  quoted: 'Quoted AI text', paraphrased: 'Paraphrased or adapted AI explanation',
  image: 'AI image, chart or code', code: 'AI image, chart or code', outline: 'Outline or structure only'
};
/* `reproduced` = AI output survives into the submitted work. */
var USE_PHRASE = {
  quoted: { verb: 'generate a passage of text', line: 'I quoted a short passage from the response in my work, marked it as AI-generated, and wrote the surrounding argument myself.', reproduced: true },
  paraphrased: { verb: 'generate an explanation I then rewrote', line: 'I rewrote the ideas in my own words, checked each claim against a source I read, and kept my own analysis.', reproduced: true },
  image: { verb: 'generate an image, chart or piece of code', line: 'I adapted the output myself, can explain how it works, and have credited it where it appears.', reproduced: true },
  code: { verb: 'generate a piece of code', line: 'I reviewed and tested the code, can explain every line of it, and have credited it where it appears.', reproduced: true },
  outline: { verb: 'suggest a structure for the work', line: 'I used the structure only; every sentence in the submitted work I wrote myself.', reproduced: false }
};
var ANNEX_USE = {
  quoted: 'quoted text', paraphrased: 'adapted explanation', image: 'image, chart or code',
  code: 'generated code', outline: 'outline or structure only'
};
var PROGRAM_ADDON = {
  ib: 'A full transcript of the exchange is retained for my teacher or supervisor, who can request it at any time.',
  ap: 'This use is recorded in the AP Digital Portfolio, and the interim checkpoints for this task have been completed.',
  bc: 'Dated planning notes and process evidence are retained.',
  gen: 'I can provide the full transcript on request.'
};
var BC_PRIVACY_SENTENCE = ' No personal or identifying information was entered into the tool.';

var SCEN_URL = 'https://media.vsb.bc.ca/media/Default/frf/103/IB%20Evaluating%20AI%20Scenarios.pdf';
var REF_URL = {
  'IB Scenario #3': SCEN_URL, 'IB Scenario #4': SCEN_URL, 'IB Scenario #5': SCEN_URL,
  'IB Scenario #7': SCEN_URL, 'IB Scenario #8': SCEN_URL, 'IB Scenario #9': SCEN_URL,
  'IB Scenario #10': SCEN_URL, 'IB Scenario #11': SCEN_URL, 'IB Scenario #12': SCEN_URL,
  'IB Visual Arts': 'https://www.ibo.org/programmes/artificial-intelligence-ai-in-learning-teaching-and-assessment/',
  'AP Art & Design': 'https://apcentral.collegeboard.org/media/pdf/ap-art-and-design-plagiarism-and-artificial-intelligence-policy-guide.pdf',
  'AP Capstone Policy': 'https://apcentral.collegeboard.org/courses/resources/ap-capstone-policies',
  'MLA/APA/Chicago': 'https://style.mla.org/citing-generative-ai-updated-revised/',
  'BC FOIPPA': 'https://www2.gov.bc.ca/gov/content/education-training/k-12/administration/program-management/ai-in-education'
};
var SPLIT_REFS = { 'IB Scenario #9': 1, 'IB Scenario #10': 1 };

var KEYS = { prefs: 'clearcite.prefs.v1', list: 'clearcite.list.v1', theme: 'clearcite.theme' };
var LIST_MAX = 30, PROMPT_MAX = 20000, LONG_PROMPT = 400;
var MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
var LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var NUM_WORDS = { 3: 'Three', 4: 'Four', 5: 'Five' };

/* 2 ------------------------------------------------------------ Pure helpers */

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
var esc = escapeHtml;
function collapseSpaces(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function wordCount(s) { var t = collapseSpaces(s); return t ? t.split(' ').length : 0; }
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

function parseISO(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  var y = +m[1], mo = +m[2], da = +m[3];
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  var probe = new Date(y, mo - 1, da);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== da) return null;
  return { y: y, m: mo, d: da };
}

function fmtDate(iso, style) {
  var p = parseISO(iso) || parseISO(todayISO()), y = p.y, m = p.m - 1, d = p.d;
  if (style === 'mla') return d + ' ' + MLA_MONTHS[m] + ' ' + y;
  if (style === 'apa') return y + ', ' + LONG_MONTHS[m] + ' ' + d;
  if (style === 'chicago') return LONG_MONTHS[m] + ' ' + d + ', ' + y;
  return d + ' ' + LONG_MONTHS[m] + ' ' + y;
}
function formatDate(iso, style) { return fmtDate(iso, style || 'ib'); }

/* Long prompts are quoted from their opening only, broken on a word boundary. */
function promptShort(text) {
  var s = collapseSpaces(text);
  if (!s || s.length <= 120) return s;
  var cut = s.slice(0, 120), stop = cut.search(/[.!?](\s|$)/);
  if (stop > 20) return cut.slice(0, stop + 1);
  var sp = cut.lastIndexOf(' ');
  if (sp > 40) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.!?]+$/, '') + '…';
}

/* MLA in-text uses the first four to six words; five reads best. */
function citeWords(text, n) { return collapseSpaces(text).split(' ').slice(0, n || 5).join(' '); }

function normaliseUrl(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  return s.replace(/\/+$/, '');
}
function mlaLocation(url) {
  return String(url || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}
function hostOf(url) { return String(url || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].replace(/^www\./i, ''); }

/* Sentence-case chat title for APA, derived from the prompt. */
var LEAD_VERBS = /^(summarise|summarize|explain|describe|write|list|compare|contrast|analyse|analyze|discuss|evaluate|outline|generate|create|give|provide|find|show|tell|help me|help|draft|produce|calculate|suggest|rewrite|improve)\s+/i;
var PREPS = { in: 1, on: 1, at: 1, for: 1, of: 1, to: 1, with: 1, about: 1, by: 1, from: 1, into: 1, over: 1, under: 1, between: 1, across: 1, within: 1 };

function deriveChatTitle(prompt) {
  var s = collapseSpaces(prompt).replace(/[.\u2026]+$/, '').replace(/[,;:!?"\u201d\u2019]+$/, '');
  if (!s) return 'AI chat';
  s = s.replace(LEAD_VERBS, '').replace(/^(the|a|an)\s+/i, '');
  var words = s.split(' '), guard = 0;
  while (words.length > 6 && guard++ < 12) {
    var cut = -1;
    for (var i = words.length - 2; i > 0; i--) { if (PREPS[words[i].toLowerCase()]) { cut = i; break; } }
    if (cut < 1) break;
    words = words.slice(0, cut);
  }
  if (words.length > 12) words = words.slice(0, 12);
  var out = words.join(' ').replace(/[,;:.!?]+$/, '');
  if (!out) return 'AI chat';
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function removeWordAll(s, word) {
  if (!word) return s;
  return s.replace(new RegExp('(^|[^\\w])' + escapeRegExp(word) + '(?![\\w])', 'gi'), '$1');
}

/* SPEC §6.4 — pure and testable. */
function normaliseModel(family, developer, raw, harnessName) {
  family = collapseSpaces(family || '');
  developer = collapseSpaces(developer || '');
  var s = collapseSpaces(raw == null ? '' : raw);
  if (!family || CUSTOM_FAMILIES[family]) return s;
  if (harnessName) {
    var hn = escapeRegExp(harnessName);
    s = s.replace(new RegExp('\\s+(?:via|using|in|on|from|with)\\s+' + hn + '$', 'i'), '').trim();
    s = s.replace(new RegExp('\\s+' + hn + '$', 'i'), '').trim();
  }
  s = removeWordAll(s, developer);
  var devBase = developer.replace(/[,.]?\s*(Inc|LLC|Ltd)\.?$/i, '').trim();
  if (devBase && devBase !== developer) s = removeWordAll(s, devBase);
  s = collapseSpaces(s).replace(/^[\s\-,.]+/, '').replace(/[\s\-,.]+$/, '');
  var famLead = new RegExp('^' + escapeRegExp(family) + '[\\s\\-]+', 'i');
  var famTest = new RegExp('^' + escapeRegExp(family) + '(?:[\\s\\-]|$)', 'i');
  var guard = 0;
  while (famLead.test(s) && guard++ < 8) {
    var rest = s.replace(famLead, '');
    if (!famTest.test(rest)) break;
    s = rest;
  }
  if (!s) return family;
  if (new RegExp('^' + escapeRegExp(family) + '(?![\\w])', 'i').test(s)) return family + s.slice(family.length);
  if (s.charAt(0) === '-') return family + s;
  if (HYPHEN_FAMILIES[family] && /^v?\d/.test(s)) return family + '-' + s.replace(/^-/, '');
  if (/^v\d/.test(s)) return family + '-' + s;
  return family + ' ' + s;
}

/* 3 ------------------------------------------------------------- Formatters */

function harnessById(id) {
  for (var i = 0; i < HARNESSES.length; i++) if (HARNESSES[i].id === id) return HARNESSES[i];
  return null;
}
function familyById(id) {
  for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return FAMILIES[i];
  return null;
}
function isCustomFamily(id) { return !!CUSTOM_FAMILIES[id]; }

/* The container / publisher name for this tool. */
function harnessContainer(input) {
  var h = harnessById(input && input.harnessId);
  if (!h) return '';
  if (h.id === 'other' || h.id === 'local') return collapseSpaces(input.harnessCustom || '') || (h.id === 'local' ? 'Local / self-hosted' : 'Other');
  return h.label;
}

function resolveModel(input) {
  var family = input.familyId || '', fam = familyById(family), custom = isCustomFamily(family);
  var raw = collapseSpaces(input.modelName || '');
  if (custom) return raw || collapseSpaces(input.familyCustom || '') || family;
  return normaliseModel(family, fam ? fam.dev : '', raw, input.includeHarness === false ? null : harnessContainer(input));
}

function buildCtx(input) {
  var i = input || {}, h = harnessById(i.harnessId), fam = familyById(i.familyId || '');
  var custom = isCustomFamily(i.familyId), includeHarness = i.includeHarness !== false;
  var harnessName = harnessContainer(i);
  var rawPrompt = String(i.prompt == null ? '' : i.prompt).replace(/\r\n?/g, '\n').trim();
  var promptFlat = collapseSpaces(rawPrompt);
  var url = normaliseUrl(i.url), baseUrl = url || (h && h.url ? h.url : '');
  var dateISO = parseISO(i.date) ? i.date : todayISO();
  return {
    harnessId: i.harnessId || '', harnessName: harnessName, family: i.familyId || '', custom: custom,
    includeHarness: includeHarness,
    container: includeHarness ? harnessName : (custom ? (collapseSpaces(i.familyCustom || '') || (i.familyId || 'Other')) : (i.familyId || '')),
    model: resolveModel(i), developer: fam ? fam.dev : '',
    prompt: rawPrompt, promptFlat: promptFlat, promptShort: promptShort(promptFlat),
    promptLong: promptFlat.length > LONG_PROMPT,
    url: url, hasUrl: !!url, fullUrl: baseUrl, location: baseUrl ? mlaLocation(baseUrl) : '', host: baseUrl ? hostOf(baseUrl) : '',
    dateISO: dateISO, dateFallback: !parseISO(i.date),
    dates: {
      mla: fmtDate(dateISO, 'mla'), apa: fmtDate(dateISO, 'apa'), chicago: fmtDate(dateISO, 'chicago'),
      ib: fmtDate(dateISO, 'ib'), year: String((parseISO(dateISO) || { y: '' }).y)
    },
    contentType: i.contentType || 'outline', edits: collapseSpaces(i.edits || ''),
    chicagoForceBib: !!i.chicagoForceBib, urlPublic: !!i.urlPublic
  };
}

function mkBlock(id, label, text, html, extra) {
  return { id: id, label: label, text: text, html: html == null ? esc(text) : html, extra: extra || [] };
}
function pendingResult(id, label, missing) {
  return { id: id, label: label, text: '', html: '', blocks: [], notes: [], pending: missing, panel: null };
}
function commonNotes(c) {
  var out = [];
  if (c.dateFallback) out.push("The date could not be read, so today's date is used.");
  if (c.promptLong) out.push('Your prompt is long, so the citation quotes the opening. The full prompt is in the prompt log.');
  return out;
}

/* MLA 9: “PROMPT” prompt. CONTAINER, model MODEL, DEVELOPER, DATE, LOCATION. */
function formatMLA(input) {
  var c = buildCtx(input), L = 'MLA 9', p = c.promptShort;
  if (!c.harnessName) return pendingResult('mla', L, 'harness');
  if (!c.promptFlat) return pendingResult('mla', L, 'prompt');
  var tail = [c.container];
  if (c.model) tail.push('model ' + c.model);
  if (c.developer) tail.push(c.developer);
  tail.push(c.dates.mla);
  if (c.location) tail.push(c.location);
  var ref = '“' + p + '” prompt. ' + tail.join(', ') + '.';
  var blocks = [mkBlock('ref', 'Reference list', ref)];
  var intext = '(“' + citeWords(c.promptFlat) + '”)';
  blocks.push(mkBlock('intext', 'In-text', intext));
  if (c.contentType === 'image') blocks.push(mkBlock('caption', 'Caption', 'Fig. 1. ' + ['“' + p + '” prompt'].concat(tail).join(', ') + '.'));
  var notes = commonNotes(c);
  if (c.includeHarness === false) notes.unshift('MLA expects a container. With the tool name hidden, the model family stands in.');
  return { id: 'mla', label: L, text: ref, html: esc(ref), blocks: blocks, notes: notes, pending: '', panel: null };
}

/* APA 7 (Sept 2025). */
function formatAPA(input) {
  var c = buildCtx(input), L = 'APA 7';
  if (!c.harnessName) return pendingResult('apa', L, 'harness');
  if (!c.promptFlat) return pendingResult('apa', L, 'prompt');
  var title = deriveChatTitle(c.promptFlat);
  var author = c.developer || c.family || c.container || 'AI tool';
  var head = author + '. (' + c.dates.apa + '). ';
  var mid = ' [Generative AI chat]. ' + (c.model ? c.model + '. ' : '') + c.fullUrl;
  var text = head + title + mid, html = esc(head) + '<em>' + esc(title) + '</em>' + esc(mid);
  var blocks = [mkBlock('ref', 'Reference list', text, html)];
  blocks.push(mkBlock('intext', 'In-text', '(' + author + ', ' + c.dates.year + ')', null,
    [{ label: 'Narrative', text: author + ' (' + c.dates.year + ')' }]));
  var notes = commonNotes(c);
  notes.push('APA does not put the prompt in the reference list. State the prompt in your Method section or an appendix.');
  return { id: 'apa', label: L, text: text, html: html, blocks: blocks, notes: notes, pending: '', panel: null };
}

function chicagoBibText(c, p) {
  var s = (c.model || c.container) + '. Response to “' + p + '.” ';
  if (c.developer) s += c.developer + ', ';
  s += c.dates.chicago + '.';
  if (c.fullUrl) s += ' ' + c.fullUrl + '.';
  return s;
}
/* Chicago treats AI chats like personal communications unless the link opens. */
function chicagoPanel(c) {
  if (c.urlPublic || c.chicagoForceBib) return null;
  return {
    text: 'Chicago treats AI chats like personal communications. They are left out of the bibliography unless a reader can open the link.',
    optIn: 'Generate the bibliography entry anyway (my teacher requires it)'
  };
}

/* Chicago 18, notes and bibliography. */
function formatChicagoNB(input) {
  var c = buildCtx(input), L = 'Chicago 18 (N&B)', p = c.promptShort;
  if (!c.harnessName) return pendingResult('chicagonb', L, 'harness');
  if (!c.promptFlat) return pendingResult('chicagonb', L, 'prompt');
  var note = '1. ' + (c.model ? c.model + ', response to “' + p + ',” ' : 'Text generated by ' + c.container + ', ');
  if (c.developer) note += c.developer + ', ';
  note += c.dates.chicago;
  if (c.fullUrl) note += ', ' + c.fullUrl;
  note += '.';
  var blocks = [mkBlock('note', 'Note', note)];
  if (c.urlPublic || c.chicagoForceBib) blocks.push(mkBlock('bib', 'Bibliography', chicagoBibText(c, p)));
  return { id: 'chicagonb', label: L, text: note, html: esc(note), blocks: blocks, notes: commonNotes(c), pending: '', panel: chicagoPanel(c) };
}

/* Chicago 18, author–date: same reference-list rule, different in-text. */
function formatChicagoAD(input) {
  var c = buildCtx(input), L = 'Chicago 18 (A–D)', p = c.promptShort;
  if (!c.harnessName) return pendingResult('chicagoad', L, 'harness');
  if (!c.promptFlat) return pendingResult('chicagoad', L, 'prompt');
  var intext = '(' + (c.model || c.container) + ', ' + c.dates.chicago + ')';
  var blocks = [], primary = intext;
  if (c.urlPublic || c.chicagoForceBib) {
    primary = chicagoBibText(c, p);
    blocks.push(mkBlock('ref', 'Reference list', primary), mkBlock('intext', 'In-text', intext));
  } else blocks.push(mkBlock('intext', 'In-text', intext));
  return { id: 'chicagoad', label: L, text: primary, html: esc(primary), blocks: blocks, notes: commonNotes(c), pending: '', panel: chicagoPanel(c) };
}

/* IB transparency format (Appendix 6). */
function formatIB(input) {
  var c = buildCtx(input), L = 'IB', p = c.promptShort;
  if (!c.harnessName) return pendingResult('ib', L, 'harness');
  if (!c.promptFlat) return pendingResult('ib', L, 'prompt');
  var intext = '(“' + p + '”, generated by ' + c.container + (c.model ? ' using ' + c.model : '') + ', ' + c.dates.ib + ')';
  var bib = (c.developer ? c.developer + '. ' : '') + (c.model ? c.model + '. ' : '') + 'Response to “' + p + '.” ' + c.dates.ib + '.';
  if (c.fullUrl) bib += ' ' + c.fullUrl + '.';
  var notes = commonNotes(c);
  notes.push('IB Appendix 6 requires quotation marks, the exact prompt and the generation date. Put the full transcript in your annex.');
  return { id: 'ib', label: L, text: intext, html: esc(intext), blocks: [mkBlock('intext', 'In-text', intext), mkBlock('bib', 'Bibliography', bib)], notes: notes, pending: '', panel: null };
}
var FORMATTERS = { mla: formatMLA, apa: formatAPA, chicagonb: formatChicagoNB, chicagoad: formatChicagoAD, ib: formatIB };

/* Disclosure statement (SPEC §6.7) and the ask-first variant (UX §6.6). */
function buildDisclosure(input) {
  var i = input || {}, c = buildCtx(i), program = i.program || 'gen';
  var use = USE_PHRASE[c.contentType] || USE_PHRASE.outline;
  var detail = c.model ? ' (' + c.model + (c.developer ? ', ' + c.developer : '') + ')' : (c.developer ? ' (' + c.developer + ')' : '');
  var setup = 'I used ' + (c.container || 'an AI tool') + detail + ' on ' + c.dates.ib + ' to ' + use.verb + '.';
  var promptLine = '';
  if (c.promptFlat) {
    promptLine = (wordCount(c.promptFlat) > 40 || c.promptLong)
      ? 'The prompt I sent was long and is reproduced in full in the annex.'
      : 'The prompt I sent was “' + promptShort(c.promptFlat) + '”.';
  }
  var check = 'I kept the response, read it critically, checked any factual claim against a source I opened myself, and did not copy sentences I could not defend.';
  var auth = use.reproduced
    ? 'The AI material identified above is credited in my text and in my reference list; everything else is my own, and I can explain and defend it.'
    : 'No AI-generated text appears in the submitted work: the argument and every sentence are my own, and I can explain and defend it.';
  var addon = PROGRAM_ADDON[program] || PROGRAM_ADDON.gen;
  if (program === 'bc') addon += (i.privacyConfirmed ? BC_PRIVACY_SENTENCE : '');
  var text;
  if (i.variant === 'ask-first') {
    text = 'Hello — I want to check something before I submit. ' + setup + (promptLine ? ' ' + promptLine : '') + ' ' + use.line +
      ' I am not sure whether this counts as acceptable use for this piece, and I would rather ask now than after marking.' +
      ' I have kept the full transcript and I can show you the draft from before the AI use. Could you tell me whether I should keep this as it stands or rework it?';
  } else {
    text = setup + (promptLine ? ' ' + promptLine : '') + ' ' + use.line + ' ' + check + ' ' + auth + ' ' + addon;
  }
  return { text: text, html: esc(text), words: wordCount(text) };
}

/* Prompt annex / AI use log (SPEC §6.8). */
function buildAnnex(input) {
  var i = input || {}, c = buildCtx(i);
  var prog = PROGRAMS.filter(function (p) { return p.id === (i.program || 'gen'); })[0] || PROGRAMS[3];
  var course = COURSES.filter(function (x) { return x.id === (i.course || 'general'); })[0] || COURSES[0];
  var style = STYLES.filter(function (s) { return s.id === (i.style || 'mla'); })[0] || STYLES[0];
  var useLabel = ANNEX_USE[c.contentType] || ANNEX_USE.outline;
  if (c.edits) useLabel += ' — ' + c.edits;
  var lines = [
    'AI USE LOG — ClearCite',
    'Program: ' + prog.label + ' · Course: ' + course.short + ' · Style: ' + style.label,
    'Tool: ' + (c.container || '—') + (c.host ? ' (' + c.host + ')' : '') + ' · Model: ' + (c.model || 'not stated') +
      (c.developer ? ' (' + c.developer + ')' : '') + ' · Date: ' + c.dates.mla,
    'Prompt: "' + (c.promptFlat || '') + '"',
    'Use: ' + useLabel
  ];
  if (c.fullUrl) lines.push('Link: ' + c.fullUrl);
  return { text: lines.join('\n'), html: esc(lines.join('\n')) };
}

/* 4 ------------------------------------------------------ Verdict computation */

function itemVisibleFor(id, program, course, answers) {
  if (id === 'a4') return program === 'bc';
  if (id === 'a5') return program === 'ap';
  if (id === 'r7') return course === 'lang-acq' || !!answers.a2;
  if (id === 'r9') return course === 'arts';
  return true;
}

function flagSeverity(item, program, a1) {
  if (item.hard) return 'prohibited';
  var sev = (item.severity && item.severity[program]) || 'context';
  return (item.summative && !a1) ? 'context' : sev;
}

function computeVerdict(input) {
  var s = input || {}, program = s.program || 'gen', course = s.course || 'general';
  var strictness = s.strictness || 'mixed', src = s.checked || s.answers || {};
  var on = function (id) { return typeof src[id] === 'boolean' ? src[id] : !!s[id]; };

  var flags = [], direct = [], indirect = [], severities = [], fixes = [], refs = [];
  FLAGS.forEach(function (item) {
    if (!on(item.id) || !itemVisibleFor(item.id, program, course, { a2: on('a2') })) return;
    var sev = flagSeverity(item, program, on('a1'));
    flags.push(item.id);
    severities.push({ id: item.id, severity: sev, refs: item.refs, fix: item.fix });
    item.refs.forEach(function (r) { refs.push(r); });
    if (sev === 'prohibited') fixes.push(item.fix);
  });
  var contextFixes = severities.filter(function (x) { return x.severity === 'context'; }).map(function (x) { return x.fix; });
  DIRECT_ITEMS.forEach(function (item) { if (on(item.id)) direct.push(item.id); });
  INDIRECT_IDS.forEach(function (id) { if (on(id)) indirect.push(id); });

  var anyUse = flags.length + direct.length + indirect.length > 0;
  var hasProhibited = severities.some(function (x) { return x.severity === 'prohibited'; });
  var transparency = anyUse && !on('a3');
  var apCheckpoint = anyUse && program === 'ap' && !on('a5');
  var privacy = program === 'bc' && !on('a4');

  /* Precedence: prohibited > context > cite > disclose > note > none > empty.
     Programme conditions are gated on use (UX §12.1), or `empty` is unreachable. */
  var level, citation;
  if (hasProhibited) { level = 'prohibited'; citation = 'blocked'; }
  else if (contextFixes.length || transparency || apCheckpoint) {
    level = 'context'; citation = direct.length ? 'full-after-approval' : 'disclosure';
  } else if (direct.length) { level = 'cite'; citation = 'full'; }
  else if (indirect.length) {
    if (strictness === 'conservative') { level = 'note'; citation = 'note'; }
    else if (strictness === 'aggressive') { level = 'cite'; citation = 'full'; }
    else { level = 'disclose'; citation = 'disclosure'; }
  } else if (anyUse) { level = 'note'; citation = 'note'; }
  else { level = 'empty'; citation = 'none'; }

  if (transparency) refs.push('IB Scenario #12');
  if (apCheckpoint) refs.push('AP Capstone Policy');
  if (privacy) refs.push('BC FOIPPA');
  if (direct.length) refs.push('MLA/APA/Chicago');

  var actions = [];
  if (level === 'prohibited') {
    actions = dedupe(fixes);
    actions.push('Talk to your teacher before you submit.');
  } else if (level === 'context') {
    actions = dedupe(contextFixes);
    actions.push('Bring the exact prompt and output to your teacher');
    if (apCheckpoint) actions.push('Complete the interim checkpoints your course requires and keep the process artefacts. An AP Capstone team that skips them can score 0 on that component.');
  }

  return {
    level: level, citation: citation, flags: flags, direct: direct, indirect: indirect, anyUse: anyUse,
    branch: direct.length ? 'direct' : (indirect.length ? 'indirect' : (flags.length ? 'flags' : 'none')),
    severities: severities,
    warnings: { transparency: transparency, apCheckpoint: apCheckpoint, privacy: privacy },
    privacyUnknown: privacy, actions: actions, refs: dedupe(refs),
    contentPhrase: directPhrase(direct, s.contentType)
  };
}

function directPhrase(direct, contentType) {
  if (!direct.length) return '';
  return direct.map(function (id) {
    if (id === 'd3' && contentType === 'outline') return 'an outline';
    var item = DIRECT_ITEMS.filter(function (d) { return d.id === id; })[0];
    return item ? item.phrase : '';
  }).filter(Boolean).join(', ');
}
function dedupe(arr) {
  var seen = {}, out = [];
  arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
}

/* 5 ----------------------------------------------------------------- State */

var state = {
  program: 'ib', course: 'ib-general', strictness: 'mixed', answers: {}, form: null,
  activeStyle: 'mla', tabOwned: false, verdict: null, result: null, list: [], storageOK: true,
  askFirst: false, advancedOpen: false, sheetOpen: false,
  touched: {}, copyMap: {}, listConfirm: null, expand: {}, moreActions: false
};
function blankForm() {
  return {
    harnessId: '', harnessCustom: '', familyId: '', familyCustom: '', modelName: '',
    includeHarness: true, prompt: '', date: todayISO(), url: '', urlPublic: false,
    contentType: 'outline', edits: '', chicagoForceBib: false
  };
}

/* 6 ------------------------------------------------------------- Renderers */

var els = {}, rowRecs = {};
function q(id) { return document.getElementById(id); }
function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); }
function programMeta() { return PROGRAMS.filter(function (p) { return p.id === state.program; })[0] || PROGRAMS[3]; }
function styleMeta() { return STYLES.filter(function (s) { return s.id === state.activeStyle; })[0] || STYLES[0]; }
function icon(id, cls) { return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
function flagById(id) { for (var i = 0; i < FLAGS.length; i++) if (FLAGS[i].id === id) return FLAGS[i]; return null; }

function renderSetup() {
  renderCourseOptions();
  var p = programMeta(), lens = els.courseNote;
  els.programNote.innerHTML = '<b>' + esc(tr(p.label)) + '</b> · ' + esc(tr(p.full)) + ' · ' + esc(tr(p.note));
  var lensId = lensOfCourse(state.course);
  if (lensId === 'general') { lens.hidden = true; lens.textContent = ''; }
  else { lens.hidden = false; lens.textContent = LENS[lensId] || ''; }
  var blurb = STRICTNESS.filter(function (s) { return s.id === state.strictness; })[0];
  els.segBlurb.textContent = blurb ? blurb.blurb : '';
  var visible = CONTEXT_IDS.filter(function (id) { return itemVisibleFor(id, state.program, lensOfCourse(state.course), state.answers); }).length;
  els.sectionADesc.textContent = (NUM_WORDS[visible] || visible) +
    ' questions about the assignment and your teacher. They change how strict the answer is, not whether you used AI.';
  translateDom(document.getElementById('setup'));
}

function renderCourseOptions() {
  var groups = COURSE_PLAN[state.program] || COURSE_PLAN.gen;
  var html = '';
  groups.forEach(function (g) {
    var opts = g.items.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(tr(c.label)) + '</option>';
    }).join('');
    html += g.label ? '<optgroup label="' + esc(tr(g.label)) + '">' + opts + '</optgroup>' : opts;
  });
  els.courseSelect.innerHTML = html;
  var valid = COURSE_INDEX[state.course] && COURSE_INDEX[state.course].program === state.program;
  els.courseSelect.value = valid ? state.course : defaultCourse(state.program);
  state.course = els.courseSelect.value;
}

function surveyRow(item) {
  var qid = 'q-' + item.id + '-label';
  return '<li class="row row-q" data-item="' + item.id + '">' +
    '<div class="q-head">' +
      '<p class="q-text" id="' + qid + '">' + esc(item.q) + '</p>' +
      '<div class="yn" role="group" aria-labelledby="' + qid + '">' +
        '<label class="yn-opt"><input type="radio" name="q-' + item.id + '" value="yes" data-check="' + item.id + '"><span>Yes</span></label>' +
        '<label class="yn-opt"><input type="radio" name="q-' + item.id + '" value="no" data-check="' + item.id + '"><span>No</span></label>' +
      '</div>' +
    '</div>' +
    '<p class="q-why">' + esc(item.why) + '</p>' +
    (item.eg ? '<p class="q-eg"><span class="micro">For example</span> ' + esc(item.eg) + '</p>' : '') +
  '</li>';
}

function renderSurvey() {
  var a = document.getElementById('rows-a');
  if (a) a.innerHTML = CONTEXT_SURVEY.map(surveyRow).join('');
  SURVEY.forEach(function (sec) {
    var ul = document.getElementById('rows-' + sec.id);
    if (ul) ul.innerHTML = sec.items.map(surveyRow).join('');
  });
}

/* Hidden items leave the DOM (UX §8.4) behind a comment marker so they can return. */
function setRowVisible(id, visible) {
  var rec = rowRecs[id];
  if (!rec) return;
  var inDom = rec.node.parentNode === rec.parent;
  if (visible && !inDom) rec.parent.replaceChild(rec.node, rec.marker);
  else if (!visible && inDom) rec.parent.replaceChild(rec.marker, rec.node);
  if (!visible) delete state.answers[id];
}
function syncChecklistRows() {
  Object.keys(rowRecs).forEach(function (id) {
    setRowVisible(id, itemVisibleFor(id, state.program, lensOfCourse(state.course), state.answers));
  });
  Object.keys(rowRecs).forEach(function (id) {
    var node = rowRecs[id].node;
    var yes = node.querySelector('input[value="yes"]');
    var no = node.querySelector('input[value="no"]');
    var ans = state.answers[id];
    if (yes) yes.checked = ans === true;
    if (no) no.checked = ans === false;
  });
}

function updateCheckUI() {
  [['a', els.rowsA], ['b1', els.rowsB1], ['b2', els.rowsB2], ['b3', els.rowsB3]].forEach(function (pair) {
    var list = pair[1];
    if (!list) return;
    var total = 0, done = 0;
    Array.prototype.forEach.call(list.querySelectorAll('.row'), function (row) {
      var id = row.getAttribute('data-item');
      var ans = state.answers[id];
      var answered = typeof ans === 'boolean';
      total++;
      if (answered) done++;
      row.classList.toggle('is-checked', ans === true);
      row.classList.toggle('is-no', ans === false);
    });
    var counter = q('count-' + pair[0]);
    if (counter) {
      counter.textContent = done + ' / ' + total;
      counter.classList.toggle('is-complete', total > 0 && done === total);
    }
  });
  renderWarnings();
}

function renderWarnings() {
  var v = state.verdict || computeVerdict(currentVerdictInput()), out = [];
  if (v.warnings.transparency) {
    out.push(warningHTML('TRANSPARENCY', 'IB Scenario #12', 'Transparency warning',
      v.level === 'prohibited'
        ? 'Your teacher does not know about this AI use yet. Tell them — but note that transparency does not fix the issue above.'
        : 'Your teacher does not know about this AI use yet. IB Scenario #12: hiding AI use is not acceptable even when the use itself was allowed. Tell them before you submit.'));
  }
  if (v.warnings.privacy) {
    out.push(warningHTML('PRIVACY', 'BC FOIPPA', 'Privacy warning',
      "BC's FOIPPA rules protect personal information. Do not enter your own or anyone else's identifying details into a tool your district has not approved. If you already did, tell your teacher."));
  }
  els.warnings.innerHTML = out.join('');
  translateDom(els.warnings);
}
function warningHTML(label, ref, aria, body) {
  return '<div class="warn" role="note" aria-label="' + esc(aria) + '">' +
    '<p class="warn-label">' + icon('i-alert') + '<span>' + esc(label) + '</span>' +
    '<a class="warn-ref" href="' + esc(REF_URL[ref] || '#policy') + '">' + esc(ref) + '</a></p>' +
    '<p class="warn-body">' + esc(body) + '</p></div>';
}

function verdictSummary(v) {
  var prose = PROGRAM_PROSE[state.program] || PROGRAM_PROSE.gen;
  if (v.level === 'prohibited') return tr('This use falls outside what {program} permits for submitted work. Fixing it is possible — start with the steps below.').replace('{program}', tr(prose));
  if (v.level === 'context') return 'This is conditional. It can be acceptable, but only with approval, supervision or a change to how you work.';
  if (v.level === 'cite') return v.branch === 'indirect'
    ? 'You used AI before you started writing, and your strictness setting treats that as a use to credit. Cite the tool so the record is complete.'
    : 'You included AI output in your work. Credit the tool in the body of your text and in your bibliography, with the prompt and the date.';
  if (v.level === 'disclose') return 'The AI did not produce content you are submitting, so no formal citation is required. Say how you used it in a short statement at the end of the work and keep your prompt history.';
  if (v.level === 'note') return 'Nothing you are submitting was produced by AI. A one-line note is enough if your teacher asks, and transparency with your teacher is still expected.';
  return 'Answer the questions. The verdict updates as you go.';
}
function conditionalChip(v) {
  if (v.level !== 'context') return '';
  var text = v.warnings.apCheckpoint ? 'unlocks when your checkpoints are done'
    : (v.warnings.transparency ? 'unlocks once your teacher knows' : "depends on your teacher's approval");
  return '<p class="v-cond">' + esc(text) + '</p>';
}
function ruleTrail(v) {
  if (!v.refs.length) return '';
  var shown = v.refs.slice(0, 6), rest = v.refs.length - shown.length;
  var chips = shown.map(function (r) {
    var url = REF_URL[r];
    var inner = url ? '<a class="chip is-link" href="' + esc(url) + '">' + esc(r) + '</a>' : '<span class="chip">' + esc(r) + '</span>';
    return SPLIT_REFS[r] ? '<span class="chip-split">' + inner + '<span class="chip-alt">elsewhere: context</span></span>' : inner;
  }).join('');
  if (rest > 0) chips += '<span class="chip">+' + rest + ' more</span>';
  return '<div class="v-trail"><p class="v-trail-label">Sources</p><div class="v-chips">' + chips + '</div></div>';
}
function actionList(v) {
  if (!v.actions.length) return '';
  var limit = 5, shown = state.moreActions ? v.actions : v.actions.slice(0, limit);
  var html = '<ol class="v-actions">' + shown.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol>';
  if (v.actions.length > limit) {
    html += '<button type="button" class="btn-link v-more" data-act="more">' +
      (state.moreActions ? 'Show fewer' : 'Show all (' + v.actions.length + ')') + '</button>';
  }
  return html;
}
function actionsHTML(v) {
  if (v.level === 'cite') {
    var h = '<div class="v-buttons"><button type="button" class="btn-primary" data-act="generate">Generate the citation</button>' +
      '<button type="button" class="btn-text" data-act="annex">Add the prompt to your appendix</button></div><p class="v-links">';
    if (v.branch === 'indirect') h += '<button type="button" class="btn-link" data-act="strictness">Change strictness</button> · ';
    return h + '<button type="button" class="btn-link" data-act="rule">See the rule</button></p>';
  }
  if (v.level === 'disclose') {
    return '<div class="v-buttons"><button type="button" class="btn-primary" data-act="disclose">Generate the disclosure statement</button>' +
      '<button type="button" class="btn-text" data-act="annex">Keep your transcript</button></div>' +
      '<p class="v-links"><button type="button" class="btn-link" data-act="rule">See the rule</button></p>';
  }
  if (v.level === 'context') {
    var c = '<div class="v-buttons"><button type="button" class="btn-primary" data-act="ask">Draft the message to your teacher</button>';
    if (v.citation === 'full-after-approval') c += '<button type="button" class="btn-text" data-act="generate">Generate the citation anyway</button>';
    return c + '</div><p class="v-links"><button type="button" class="btn-link" data-act="rule">See the rule</button></p>';
  }
  if (v.level === 'note') return '<p class="v-links"><button type="button" class="btn-link" data-act="cards">See the policy cards</button></p>';
  if (v.level === 'prohibited') return '<p class="v-links"><button type="button" class="btn-link" data-act="rule">See the rule</button></p>';
  return '';
}

/* The one line that answers "what do I hand in?", shown at every level except empty. */
function citationLine(v) {
  if (!v || v.level === 'empty') return '';
  var text;
  if (v.citation === 'blocked') {
    text = (v.direct && v.direct.length)
      ? 'Full citation needed if you keep the AI output — resolve the issue above first.'
      : 'Not until the issue above is resolved.';
  } else if (v.citation === 'full') {
    text = 'Full citation — in-text and bibliography.';
  } else if (v.citation === 'full-after-approval') {
    text = 'Full citation once your teacher approves.';
  } else if (v.citation === 'disclosure') {
    text = 'Disclosure statement at the end of the work.';
  } else if (v.citation === 'note') {
    text = 'No citation required. A short note is optional.';
  } else {
    text = 'No citation required.';
  }
  return '<p class="v-citation"><span class="v-citation-label">Citation</span>' +
    '<span class="v-citation-text">' + esc(text) + '</span></p>';
}

function renderVerdict() {
  var v = state.verdict, meta = LEVEL_META[v.level], panel = els.verdictPanel, html = '';
  panel.className = 'verdict is-' + v.level;
  html += '<div class="v-head"><p class="v-eyebrow">' + icon(meta.icon) + '<span>' + esc(meta.eyebrow) + '</span></p>' +
    '<h3 class="v-title" id="verdict-title">' + esc(meta.title) + '</h3>';
  if (v.level === 'cite' && v.contentPhrase) {
    html += '<p class="v-sub">In your work: ' + esc(v.branch === 'indirect' ? 'no AI output — credit given for transparency' : v.contentPhrase) + '.</p>';
  }
  html += conditionalChip(v) + '</div><div class="v-body">';
  html += '<p class="v-summary">' + esc(verdictSummary(v)) + '</p>';
  html += citationLine(v);
  if (v.level === 'prohibited') {
    html += '<div class="v-proh-block">Disclosure does not convert a prohibited use into an allowed one.</div>' + actionList(v);
  } else if (v.level === 'context') html += actionList(v);
  if (v.level === 'empty') html += '<p class="v-extra">Nothing is sent anywhere — this page runs entirely in your browser. You can change any answer.</p>';
  html += actionsHTML(v);
  if (v.privacyUnknown) html += '<p class="v-privacy">Privacy: you have not confirmed that no personal information was entered.</p>';
  html += ruleTrail(v) + '</div>';
  panel.innerHTML = html;

  /* the bar mirrors the panel; it is a summary control, not a second surface */
  if (els.vbar) {
    els.vbar.className = 'vbar is-' + v.level;
    els.vbarEyebrow.textContent = meta.eyebrow;
    els.vbarTitle.textContent = meta.title;
    els.vbar.setAttribute('aria-label', 'Verdict: ' + meta.eyebrow.toLowerCase() + '. Open verdict details.');
  }
  translateDom(panel);
  if (els.vbar) translateDom(els.vbar);
}

function ctxInput() {
  var f = state.form, o = {};
  Object.keys(f).forEach(function (k) { o[k] = f[k]; });
  o.program = state.program; o.course = state.course; o.strictness = state.strictness;
  o.style = state.activeStyle; o.privacyConfirmed = !!state.answers.a4;
  return o;
}
function ctxInputWith(extra) {
  var o = ctxInput();
  Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

var PLACEHOLDER = {
  prompt: 'Add the prompt above — the citation appears here.',
  harness: 'Choose the tool you used above — the citation appears here.'
};
function copyBtn(key, label, aria) {
  return '<button type="button" class="btn-copy" data-copy="' + key + '" data-copy-label="' + esc(label) + '" aria-label="' + esc(aria) + '">' +
    icon('i-copy', 'icon-copy') + icon('i-check', 'icon-check') + '<span>Copy</span></button>';
}
function promptLogBlock(map) {
  var annex = buildAnnex(ctxInput());
  map.annex = annex.text;
  return '<div class="out-block"><div class="out-head"><span class="out-label">Prompt log · for your appendix</span>' +
    copyBtn('annex', 'Prompt log', 'Copy the prompt log') + '</div>' +
    '<div class="out-body"><pre class="prompt-log">' + esc(annex.text) + '</pre>' +
    '<p class="out-note">Append the full transcript of the exchange below this log before you submit.</p></div></div>';
}

function renderOutputs() {
  syncStylePick();
  var r = FORMATTERS[state.activeStyle](ctxInput());
  state.result = r;
  var v = state.verdict, style = styleMeta(), blocked = v.citation === 'blocked', map = {};
  var html = '';

  if (blocked) {
    html += '<div class="strip is-proh"><p>Your verdict is Not allowed, so citations are paused. The prompt log below is still yours to copy — your teacher may ask for it.</p>' +
      '<p class="strip-extra">If your teacher approves a revised version, change your answers in 01 Check and these unlock.</p>' +
      '<p><a class="strip-link" href="#check">Change my answers in 01 Check</a></p></div>';
  } else if (v.citation === 'full-after-approval') {
    html += '<div class="strip is-attn"><p>Not for submission until your teacher approves. This marks your work as containing AI output.</p></div>';
  } else if (v.level === 'note') {
    html += '<div class="strip is-neut"><p>You do not need this for submission. It is here if your teacher asks for it.</p></div>';
  } else if (v.level === 'cite' && v.branch === 'indirect') {
    html += '<div class="strip is-neut"><p>Aggressive cites every interaction. Most teachers only require this for output you reproduced.</p></div>';
  }

  html += '<p class="out-kicker">' + esc(style.label) + ' · ' + esc(tr('output')) + '</p>';
  html += '<div class="output-panel" id="panel-' + state.activeStyle + '" role="region" aria-label="' +
    esc(style.label) + ' citation" tabindex="0">';

  if (r.pending) {
    html += '<div class="out-placeholder">' + esc(PLACEHOLDER[r.pending] || PLACEHOLDER.prompt) + '</div>';
    if (blocked) html += promptLogBlock(map);
  } else {
    var disclosure = buildDisclosure(ctxInput()), blocks = [];
    var dLabel = v.level === 'cite' && v.branch === 'indirect' ? 'Disclosure statement · optional' : 'Disclosure statement · required';
    if (state.askFirst) {
      var ask = buildDisclosure(ctxInputWith({ variant: 'ask-first' }));
      blocks.push({ kind: 'd', label: 'Message to your teacher · draft', text: ask.text, html: ask.html, ask: true });
    }
    if (v.citation === 'disclosure') {
      blocks.push({ kind: 'd', label: dLabel, text: disclosure.text, html: disclosure.html });
      r.blocks.forEach(function (b) { blocks.push({ kind: 'c', b: b, label: b.label + ' · optional' }); });
    } else if (v.level === 'note' || v.level === 'empty') {
      r.blocks.forEach(function (b) { blocks.push({ kind: 'c', b: b }); });
    } else {
      r.blocks.forEach(function (b) { blocks.push({ kind: 'c', b: b }); });
      blocks.push({ kind: 'd', label: dLabel, text: disclosure.text, html: disclosure.html });
    }

    blocks.forEach(function (blk, idx) {
      if (blk.kind === 'c') {
        var key = 'b' + idx;
        map[key] = blk.b.text;
        html += '<div class="out-block"><div class="out-head"><span class="out-label">' + esc(blk.label || blk.b.label) + '</span>' +
          copyBtn(key, style.label + ' ' + blk.b.label.toLowerCase(), 'Copy ' + style.label + ' ' + blk.b.label.toLowerCase()) +
          '</div><div class="out-body"><p class="cite-text">' + blk.b.html + '</p>';
        (blk.b.extra || []).forEach(function (ex) {
          html += '<p class="out-sub"><span class="micro">' + esc(ex.label) + '</span> ' + esc(ex.text) + '</p>';
        });
        html += '</div></div>';
      } else {
        var dk = 'd' + idx;
        map[dk] = blk.text;
        html += '<div class="out-block"><div class="out-head"><span class="out-label">' + esc(blk.label) + '</span>' +
          copyBtn(dk, blk.ask ? 'message to your teacher' : 'disclosure statement', blk.ask ? 'Copy the message to your teacher' : 'Copy the disclosure statement') +
          '</div><div class="out-body"><p class="disclosure-text">' + blk.html + '</p>';
        if (blk.ask) html += '<p class="out-note">Send this as it is, or edit it — your teacher knows your work better than this tool does.</p>';
        html += '</div></div>';
      }
    });

    if (r.panel) {
      html += '<div class="out-note is-info">' + esc(r.panel.text) +
        '<label class="check-inline out-optin"><input type="checkbox" id="chicago-optin"' + (state.form.chicagoForceBib ? ' checked' : '') + '>' +
        '<span class="box" aria-hidden="true"><svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><use href="#i-tick"/></svg></span>' +
        '<span class="row-text">' + esc(r.panel.optIn) + '</span></label></div>';
    }
    if (v.privacyUnknown && state.program === 'bc') {
      html += '<div class="out-note is-info">That sentence is left out because you have not confirmed it. Add it back only when it is true.</div>';
    }
    r.notes.forEach(function (n) { html += '<div class="out-note is-info">' + esc(n) + '</div>'; });
    html += promptLogBlock(map);
  }
  html += '</div>';

  var addLabel = 'Add to list', addDisabled = '';
  if (blocked) { addLabel = 'Fix the issue first'; addDisabled = ' disabled'; }
  else if (r.pending) { addLabel = r.pending === 'harness' ? 'Choose the tool first' : 'Add the prompt first'; addDisabled = ' disabled'; }
  else if (state.list.length >= LIST_MAX) { addLabel = 'List is full (' + LIST_MAX + ')'; addDisabled = ' disabled'; }
  html += '<div class="panel-actions"><button type="button" class="btn-primary" data-act="add"' + addDisabled + '>' + esc(addLabel) +
    '</button><button type="button" class="btn-text" data-act="print">' + icon('i-print') + ' Print</button></div>';

  els.outputStack.innerHTML = html;
  state.copyMap = map;
  translateDom(els.outputStack);
  renderPrint();
  updateMobileReveal();
}

function renderPrint() {
  var r = state.result;
  if (!r || r.pending) { els.printSheet.innerHTML = '<p class="print-empty">Nothing to print yet — add the prompt in 02 Cite.</p>'; return; }
  var course = COURSES.filter(function (c) { return c.id === state.course; })[0] || COURSES[0];
  var meta = LEVEL_META[state.verdict.level];
  var disclosure = buildDisclosure(ctxInput()), annex = buildAnnex(ctxInput());
  var h = '<div class="print-head"><p class="print-brand">ClearCite</p><p class="print-meta">' +
    esc(programMeta().label) + ' · ' + esc(course.short) + ' · ' + esc(styleMeta().label) + '</p></div>' +
    '<p class="print-generated">Generated ' + esc(fmtDate(todayISO(), 'ib')) + '</p>' +
    '<p class="print-status">Status: [' + esc(meta.eyebrow.toUpperCase()) + '] — ' + esc(meta.title) + '</p>';
  r.blocks.forEach(function (b) { h += '<div class="print-block"><h3>' + esc(b.label) + '</h3><p>' + b.html + '</p></div>'; });
  h += '<div class="print-block"><h3>Disclosure statement</h3><p class="print-prose">' + disclosure.html + '</p></div>' +
    '<div class="print-block"><h3>Prompt log</h3><pre>' + esc(annex.text) + '</pre></div>' +
    '<p class="print-foot">Not official guidance. ClearCite is an independent study aid. It is not published or endorsed by the IB, the College Board or the BC Ministry of Education. Your school\'s policy and your teacher\'s instructions take precedence.</p>';
  els.printSheet.innerHTML = h;
}

function updateMobileReveal() {
  var narrow = window.innerWidth < 1024, hasPrompt = !!collapseSpaces(state.form.prompt);
  if (els.showOutput) els.showOutput.hidden = !(narrow && hasPrompt);
  if (els.readyCount) {
    if (narrow && hasPrompt && state.result && !state.result.pending) {
      els.readyCount.hidden = false;
      els.readyCount.textContent = (state.result.blocks.length + 2) + ' forms ready below';
    } else els.readyCount.hidden = true;
  }
}

function renderHarnessOptions() {
  var html = '<option value="">Choose the tool you used</option>';
  HARNESS_GROUPS.forEach(function (g) {
    var opts = HARNESSES.filter(function (h) { return h.group === g.id; }).map(function (h) {
      return '<option value="' + esc(h.id) + '">' + esc(h.label) + '</option>';
    }).join('');
    html += '<optgroup label="' + esc(g.label) + '">' + opts + '</optgroup>';
  });
  els.harness.innerHTML = html;
}

function renderModelLine() {
  var f = state.form, h = harnessById(f.harnessId);
  var fixed = h && h.fixed ? h.fixed : '';
  if (fixed && f.familyId !== fixed) { f.familyId = fixed; if (els.family) els.family.value = fixed; }
  var fam = familyById(f.familyId), line;
  var famLabel = tr('Model family');
  if (fixed) line = famLabel + ': ' + fixed + (fam && fam.dev ? ' · ' + fam.dev : '');
  else if (!f.familyId) line = tr('Model family: not set — choose one if you know it.');
  else if (isCustomFamily(f.familyId)) line = famLabel + ': ' + (collapseSpaces(f.familyCustom) || f.familyId);
  else line = famLabel + ': ' + f.familyId + (fam && fam.dev ? ' · ' + fam.dev : '');
  els.modelLine.textContent = line;
  els.modelLine.hidden = !fixed;
  els.familyWrap.hidden = !!fixed;
  els.familyCustomWrap.hidden = !isCustomFamily(f.familyId);
  var norm = resolveModel(f), raw = collapseSpaces(f.modelName), msg;
  if (!f.familyId) msg = '';
  else if (!raw) msg = tr('The citation will use {model}.').replace('{model}', norm || f.familyId);
  else if (norm !== raw) msg = describeNormalisation(f, norm, raw);
  else msg = tr('In the citation: {model}').replace('{model}', norm);
  els.modelPreview.textContent = msg;
  els.includeHarnessHelp.hidden = f.includeHarness !== false;
}

function updateUrlNotes() {
  var raw = collapseSpaces(state.form.url || ''), warn = '', prev = '';
  if (raw) {
    var withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    var host = '', path = '';
    try { var u = new URL(withScheme); host = u.hostname.replace(/^www\./i, ''); path = u.pathname + u.search; } catch (e) { host = ''; }
    if (!host) {
      warn = 'That does not look like a link. It will print as you typed it.';
    } else {
      var labels = host.split('.').length;
      var shareish = /share|search|\/s\/|\/c\//i.test(path);
      if (labels > 2) {
        warn = 'This link uses a subdomain (' + host + '). Share links usually sit on the main domain, so check it opens in a private window before you rely on it.';
      } else if (!shareish) {
        warn = 'This does not look like a share link. If it only opens your own chat after signing in, a reader cannot use it.';
      }
    }
    if (state.activeStyle === 'mla') prev = 'MLA prints this as ' + mlaLocation(withScheme) + ' — the protocol and “www” are dropped.';
    else if (state.activeStyle === 'apa') prev = 'APA keeps the full address: ' + withScheme + '.';
    else prev = 'This style keeps the full address. Chicago only lists the chat if a reader can open the link.';
  }
  if (els.urlWarn) { els.urlWarn.hidden = !warn; els.urlWarn.textContent = warn; }
  if (els.urlStyle) { els.urlStyle.hidden = !prev; els.urlStyle.textContent = prev; }
}

function describeNormalisation(f, norm, raw) {
  var dev = (familyById(f.familyId) || {}).dev || '', lowerRaw = raw.toLowerCase(), lowerNorm = norm.toLowerCase();
  var hn = f.includeHarness === false ? '' : harnessContainer(f).toLowerCase();
  if (dev && lowerRaw.indexOf(dev.toLowerCase()) >= 0 && lowerNorm.indexOf(dev.toLowerCase()) < 0) return tr('We removed the developer name: ') + norm;
  if (hn && lowerRaw.indexOf(hn) >= 0 && lowerNorm.indexOf(hn) < 0) return tr('We removed the tool name: ') + norm;
  var fam = f.familyId || '';
  if (new RegExp(escapeRegExp(fam) + '[\\s\\-]+' + escapeRegExp(fam), 'i').test(raw)) return tr('We removed the duplicate name: ') + norm;
  if (fam && lowerNorm.indexOf(fam.toLowerCase()) === 0 && lowerRaw.indexOf(fam.toLowerCase()) !== 0) return tr('We added the family: ') + norm;
  if (HYPHEN_FAMILIES[fam] && lowerNorm.indexOf('v') > -1 && lowerRaw.charAt(0) !== 'v') return tr('We added the version prefix: ') + norm;
  return tr('In the citation: ') + norm;
}

function firstWords(text, n) { return collapseSpaces(text).split(' ').slice(0, n).join(' '); }

function renderList() {
  var n = state.list.length;
  els.listCount.classList.toggle('is-warn', false);
  els.listCount.textContent = state.storageOK ? (n ? n + ' saved' : 'saved locally') : (n ? n + ' saved · saved for this tab only' : 'saved locally');
  if (n >= LIST_MAX) els.listCount.textContent = LIST_MAX + ' / ' + LIST_MAX;

  if (!n) {
    els.listActionsWrap.innerHTML = '';
    els.listBody.innerHTML = '<div class="list-empty"><h3>No saved citations yet</h3>' +
      '<p>Anything you add here stays in this browser. Nothing is uploaded. Use it to build the reference list at the end of your assignment.</p>' +
      (state.storageOK ? '' : '<p>This browser is not saving anything, so this list lasts until you close the tab.</p>') +
      '<p><a class="btn-text" href="#cite">' + icon('i-plus') + ' Go to the citation form</a></p></div>';
    translateDom(els.listBody);
    return;
  }

  var confirming = state.listConfirm;
  els.listActionsWrap.innerHTML = '<div class="list-actions">' + (confirming === 'clear'
    ? '<p class="list-confirm">Clear all ' + n + '? <button type="button" class="btn-text" data-list="keep">Keep</button> <button type="button" class="btn-danger" data-list="clear-yes">Clear all</button></p>'
    : '<button type="button" class="btn-text" data-list="copy-all">Copy all</button>' +
      '<button type="button" class="btn-text" data-list="export-md">Export .md</button>' +
      '<button type="button" class="btn-text" data-list="export-txt">Export .txt</button>' +
      '<button type="button" class="btn-text" data-list="clear">Clear list</button>') + '</div>';

  var html = '';
  state.list.forEach(function (item, i) {
    var expanded = !!state.expand[item.id], long = item.plain.length > 220, del = confirming === item.id;
    html += '<div class="li" data-id="' + esc(item.id) + '"><div class="li-main">' +
      '<p class="li-badge">' + esc(item.styleLabel) + '</p>' +
      '<p class="li-meta">' + esc(item.meta) + '</p>' +
      '<p class="li-text' + (expanded ? ' is-open' : (long ? ' is-clamped' : '')) + '">' + esc(item.plain) + '</p>' +
      (long ? '<button type="button" class="btn-link li-expand" data-list="expand" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        (expanded ? 'Hide' : 'Show all') + '</button>' : '') +
      '</div><div class="li-actions">' + (del
        ? '<p class="li-confirm">Remove this citation? <button type="button" class="btn-text" data-list="keep">Keep</button> <button type="button" class="btn-danger" data-list="remove">Remove</button></p>'
        : '<button type="button" class="btn-icon" data-list="copy" aria-label="Copy ' + esc(item.styleLabel) + ' citation">' + icon('i-copy') + '</button>' +
          '<button type="button" class="btn-icon" data-list="up" aria-label="' + esc('Move up: ' + firstWords(item.plain, 6)) + '"' + (i === 0 ? ' aria-disabled="true"' : '') + '>' + icon('i-up') + '</button>' +
          '<button type="button" class="btn-icon" data-list="down" aria-label="' + esc('Move down: ' + firstWords(item.plain, 6)) + '"' + (i === n - 1 ? ' aria-disabled="true"' : '') + '>' + icon('i-down') + '</button>' +
          '<button type="button" class="btn-icon is-danger" data-list="del" aria-label="Delete citation">' + icon('i-trash') + '</button>') +
      '</div></div>';
  });
  els.listBody.innerHTML = html;
  translateDom(els.listBody);
  translateDom(els.listActionsWrap);
}

function renderAll() {
  state.verdict = computeVerdict(currentVerdictInput());
  if (state.verdict.level !== 'context' && state.askFirst) state.askFirst = false;
  renderSetup();
  syncChecklistRows();
  updateCheckUI();
  renderVerdict();
  renderOutputs();
  renderModelLine();
  renderList();
  document.documentElement.lang = LANG;
  if (els.lang) els.lang.value = LANG;
  translateDom(document.body);
  showPolicyLangNote();
  announceVerdict();
  savePrefs();
}

function currentVerdictInput() {
  return {
    program: state.program, course: lensOfCourse(state.course), strictness: state.strictness,
    checked: state.answers, contentType: state.form ? state.form.contentType : 'outline'
  };
}

var lastLevel = null, liveTimer = null;
function announceVerdict() {
  var v = state.verdict;
  if (v.level === lastLevel) return;
  lastLevel = v.level;
  var meta = LEVEL_META[v.level], text;
  if (v.level === 'empty') text = 'Verdict: nothing selected yet.';
  else if (v.level === 'prohibited') text = 'Verdict: not allowed. Not allowed as described. Citations are paused.';
  else text = 'Verdict: ' + meta.eyebrow.toLowerCase() + '. ' + meta.title + '.';
  clearTimeout(liveTimer);
  liveTimer = setTimeout(function () { els.verdictLive.textContent = text; }, 400);
}

/* 7 --------------------------------------------------------------- Storage */

function storageProbe() {
  try {
    var k = 'clearcite.probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
}
function readJSON(key, fallback) {
  try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}
var saveTimer = null;
function savePrefs() {
  if (!state.storageOK) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    writeJSON(KEYS.prefs, {
      program: state.program, course: state.course, strictness: state.strictness,
      activeStyle: state.activeStyle, tabOwned: state.tabOwned, form: state.form, lang: LANG
    });
  }, 300);
}
function saveList() {
  if (!state.storageOK) return true;
  var ok = writeJSON(KEYS.list, state.list);
  if (!ok) {
    toast('Your browser is out of storage, so this citation is only in this tab. Export your list, then clear it.', 6000);
    els.listCount.textContent = 'Not saved — export before you leave';
    els.listCount.classList.add('is-warn');
  }
  return ok;
}

/* 8 ---------------------------------------------------------------- Events */

function debounce(fn, ms) {
  var t = null;
  return function () {
    var args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(null, args); }, ms);
  };
}
function reinstate() {
  state.verdict = computeVerdict(currentVerdictInput());
  renderVerdict();
  renderOutputs();
  renderWarnings();
  renderList();
  announceVerdict();
  savePrefs();
}
var reRenderSoon = debounce(reinstate, 120);

function scrollToEl(el) {
  if (!el) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
function focusCopy(key) {
  var btn = els.outputStack.querySelector('[data-copy="' + key + '"]');
  if (btn) btn.focus();
}
function renderStylePick() {
  els.stylePick.innerHTML = STYLES.map(function (s) {
    return '<label class="style-opt"><input type="radio" name="style" value="' + esc(s.id) + '"' +
      (s.id === state.activeStyle ? ' checked' : '') + '><span>' + esc(s.label) + '</span></label>';
  }).join('');
}
function syncStylePick() {
  if (!els.stylePick) return;
  Array.prototype.forEach.call(els.stylePick.querySelectorAll('input'), function (i) {
    i.checked = i.value === state.activeStyle;
  });
  if (els.styleHelp) els.styleHelp.textContent = tr(STYLE_HELP[state.activeStyle] || TAB_HELP[state.program] || '');
}
function setStyle(id) {
  if (state.activeStyle === id) return;
  state.activeStyle = id;
  state.tabOwned = true;
  state.askFirst = false;
  syncStylePick();
  updateUrlNotes();
  renderOutputs();
  savePrefs();
}

/* -- clipboard ------------------------------------------------------------- */
function legacyCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}
function copyText(text, onDone) {
  var finish = function (ok) { if (ok) onDone(); else selectByHand(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { finish(true); }, function () {
      finish(legacyCopy(text));
    });
  } else finish(legacyCopy(text));
}
function selectByHand() {
  toast('Copy is blocked in this browser. The text is selected — press Ctrl+C (⌘C on a Mac).', 6000);
  setTimeout(function () {
    var panel = document.querySelector('.output-panel .cite-text, .output-panel .prompt-log, .output-panel .disclosure-text');
    if (!panel) return;
    var range = document.createRange();
    range.selectNodeContents(panel);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, 0);
}
function copyBlock(key) {
  var text = state.copyMap[key];
  if (!text) return;
  var btn = els.outputStack.querySelector('[data-copy="' + key + '"]');
  copyText(text, function () {
    if (btn) {
      btn.classList.add('is-copied');
      var label = btn.querySelector('span');
      if (label) label.textContent = 'Copied';
      clearTimeout(btn._t);
      btn._t = setTimeout(function () {
        btn.classList.remove('is-copied');
        if (label) label.textContent = 'Copy';
      }, 1600);
    }
    els.copyLive.textContent = (btn ? btn.getAttribute('data-copy-label') : 'Citation') + ' copied to clipboard.';
  });
}

/* -- toast ----------------------------------------------------------------- */
var toastTimer = null;
function toast(message, ms) {
  els.toast.textContent = tr(message);
  els.toast.hidden = false;
  els.toast.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    els.toast.classList.remove('is-show');
    setTimeout(function () { els.toast.hidden = true; }, 160);
  }, ms || 3200);
}

/* -- checklist ------------------------------------------------------------- */
function onCheckChange(input) {
  var id = input.getAttribute('data-check');
  if (!id) return;
  state.answers[id] = input.type === 'radio' ? input.value === 'yes' : input.checked;
  if (id === 'a2') syncChecklistRows();
  if (id === 'd1' || id === 'd2' || id === 'd3') syncContentType();
  if (id === 'a2' || id === 'a4' || id === 'a5') renderSetup();
  updateCheckUI();
  reRenderSoon();
}
function syncContentType() {
  var f = state.form;
  if (f.contentTypeOwned) return;
  f.contentType = state.answers.d1 ? 'quoted' : (state.answers.d2 ? 'paraphrased' : (state.answers.d3 ? 'image' : 'outline'));
  els.contentType.value = f.contentType;
}

/* -- verdict actions ------------------------------------------------------- */
function panelAction(act) {
  if (act === 'generate') { goToPrompt(); return; }
  if (act === 'ask') {
    state.askFirst = true;
    renderOutputs();
    closeSheet();
    scrollToEl(els.outputStack);
    var b = els.outputStack.querySelector('[data-copy^="d"]');
    if (b) b.focus();
    return;
  }
  if (act === 'disclose') {
    closeSheet();
    scrollToEl(els.outputStack);
    var btn = els.outputStack.querySelector('[data-copy^="d"]');
    if (btn) btn.focus();
    return;
  }
  if (act === 'annex') { closeSheet(); scrollToEl(els.outputStack); focusCopy('annex'); return; }
  if (act === 'rule') { closeSheet(); openAccordion(ruleAccordion()); return; }
  if (act === 'cards') { closeSheet(); openAccordion('acc1-btn'); return; }
  if (act === 'strictness') {
    closeSheet();
    var first = els.strictnessField.querySelector('input:checked') || els.strictnessField.querySelector('input');
    if (first) first.focus();
    return;
  }
  if (act === 'more') { state.moreActions = !state.moreActions; renderVerdict(); }
}
function ruleAccordion() {
  if (state.program === 'ap') return 'acc2-btn';
  if (state.program === 'bc') return 'acc3-btn';
  return 'acc1-btn';
}
function goToPrompt() {
  closeSheet();
  syncContentType();
  scrollToEl(els.prompt);
  els.prompt.focus({ preventScroll: true });
}

function openAccordion(id) {
  var btn = document.getElementById(id);
  if (!btn) return;
  var panel = document.getElementById(btn.getAttribute('aria-controls'));
  var open = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  panel.classList.toggle('is-open', !open);
  if (open) panel.setAttribute('inert', ''); else panel.removeAttribute('inert');
  if (!open) { scrollToEl(btn); btn.focus({ preventScroll: true }); }
}

/* -- mobile verdict sheet -------------------------------------------------- */
function openSheet() {
  if (state.sheetOpen) return;
  state.sheetOpen = true;
  els.sheet.hidden = false;
  els.backdrop.hidden = false;
  els.vbar.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(function () {
    els.sheet.classList.add('is-open');
    els.backdrop.classList.add('is-open');
  });
  els.sheetTitle.focus();
}
function closeSheet() {
  if (!state.sheetOpen) return;
  state.sheetOpen = false;
  els.sheet.classList.remove('is-open');
  els.backdrop.classList.remove('is-open');
  els.vbar.setAttribute('aria-expanded', 'false');
  setTimeout(function () {
    if (state.sheetOpen) return;
    els.sheet.hidden = true;
    els.backdrop.hidden = true;
  }, 220);
  els.vbar.focus();
}

/* -- list ------------------------------------------------------------------ */
function announceList(msg) { els.listLive.textContent = msg; }

function addToList() {
  var r = state.result, f = state.form, style = styleMeta();
  if (!r || r.pending || state.verdict.citation === 'blocked' || state.list.length >= LIST_MAX) return;
  if (state.list.some(function (x) { return x.plain === r.text && x.style === style.id; })) { toast('Already in your list.'); return; }
  var course = COURSES.filter(function (c) { return c.id === state.course; })[0] || COURSES[0];
  state.list.unshift({
    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), style: style.id, styleLabel: style.label,
    program: state.program, course: state.course, html: r.html, plain: r.text,
    prompt: collapseSpaces(f.prompt), date: f.date, model: resolveModel(f),
    meta: programMeta().label + ' · ' + course.short + ' · ' + fmtDate(f.date, 'mla'),
    createdAt: new Date().toISOString()
  });
  saveList();
  renderList();
  renderOutputs();
  announceList('Added to your list.');
  toast('Added to your list.');
}

function moveItem(index, dir) {
  var n = state.list.length, target = index + dir;
  if (target < 0) { announceList('Already at the top.'); return; }
  if (target >= n) { announceList('Already at the bottom.'); return; }
  var tmp = state.list[index];
  state.list[index] = state.list[target];
  state.list[target] = tmp;
  saveList();
  renderList();
  var row = els.listBody.querySelectorAll('.li')[target];
  var btn = row ? row.querySelector('[data-list="' + (dir < 0 ? 'up' : 'down') + '"]') : null;
  if (btn) btn.focus();
  announceList('Moved to position ' + (target + 1) + ' of ' + n + '.');
}

function removeItem(id) {
  var idx = -1;
  state.list.forEach(function (it, i) { if (it.id === id) idx = i; });
  if (idx < 0) return;
  state.list.splice(idx, 1);
  state.listConfirm = null;
  saveList();
  renderList();
  renderOutputs();
  if (!state.list.length) {
    els.listTitle.focus();
    announceList('Citation removed. Your list is empty.');
  } else {
    var rows = els.listBody.querySelectorAll('.li');
    var next = rows[Math.min(idx, rows.length - 1)];
    var b = next ? next.querySelector('[data-list="del"]') : null;
    if (b) b.focus();
    announceList('Citation removed. ' + state.list.length + ' saved.');
  }
}

function listPlainText() {
  var groups = {}, order = [];
  state.list.forEach(function (it) {
    if (!groups[it.style]) { groups[it.style] = []; order.push(it.style); }
    groups[it.style].push(it);
  });
  var multiple = order.length > 1, out = [], n = 0;
  order.forEach(function (style) {
    if (multiple) out.push(groups[style][0].styleLabel);
    groups[style].forEach(function (it) { n++; out.push(n + '. ' + it.plain); });
  });
  return out.join(multiple ? '\n\n' : '\n');
}

function wrapText(text, width) {
  return text.split('\n').map(function (line) {
    if (line.length <= width) return line;
    var words = line.split(' '), out = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > width) { out.push(cur); cur = w; }
      else cur = (cur ? cur + ' ' : '') + w;
    });
    if (cur) out.push(cur);
    return out.join('\n');
  }).join('\n');
}

function exportText(kind) {
  var course = COURSES.filter(function (c) { return c.id === state.course; })[0] || COURSES[0];
  var stamp = todayISO(), text;
  if (kind === 'md') {
    var groups = {}, order = [];
    state.list.forEach(function (it) {
      if (!groups[it.style]) { groups[it.style] = []; order.push(it.style); }
      groups[it.style].push(it);
    });
    var lines = ['# ClearCite citations', '', programMeta().label + ' · ' + course.short + ' · exported ' + stamp, ''];
    order.forEach(function (style) {
      lines.push('## ' + groups[style][0].styleLabel, '');
      groups[style].forEach(function (it, i) { lines.push((i + 1) + '. ' + it.plain, ''); });
    });
    text = lines.join('\n');
  } else {
    text = wrapText(programMeta().label + ' · ' + course.short + ' · exported ' + stamp + '\n\n' + listPlainText(), 100);
  }
  try {
    var blob = new Blob([text], { type: kind === 'md' ? 'text/markdown' : 'text/plain' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = 'clearcite-citations-' + stamp + '.' + (kind === 'md' ? 'md' : 'txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Exported ' + state.list.length + ' citations.');
  } catch (e) { showExportFallback(text); }
}
function showExportFallback(text) {
  var box = document.createElement('div');
  box.className = 'export-fallback';
  box.innerHTML = '<p>Your browser blocked the download. Everything is below — select it and copy by hand.</p><pre>' + esc(text) + '</pre>' +
    '<p><button type="button" class="btn-text" data-list="select-all">Select all</button> <button type="button" class="btn-text" data-list="dismiss">Close</button></p>';
  els.listActionsWrap.parentNode.insertBefore(box, els.listActionsWrap.nextSibling);
}

function listAction(btn) {
  var act = btn.getAttribute('data-list'), row = btn.closest('.li'), id = row ? row.getAttribute('data-id') : null;
  var index = -1;
  state.list.forEach(function (x, i) { if (x.id === id) index = i; });
  if (act === 'copy') {
    var item = state.list[index];
    if (!item) return;
    copyText(item.plain, function () {
      btn.classList.add('is-copied');
      setTimeout(function () { btn.classList.remove('is-copied'); }, 1600);
      els.copyLive.textContent = item.styleLabel + ' citation copied to clipboard.';
    });
    return;
  }
  if (act === 'up' || act === 'down') {
    if (btn.getAttribute('aria-disabled') === 'true') { announceList(act === 'up' ? 'Already at the top.' : 'Already at the bottom.'); return; }
    moveItem(index, act === 'up' ? -1 : 1);
    return;
  }
  if (act === 'del') {
    state.listConfirm = id;
    renderList();
    var keep = els.listBody.querySelector('[data-list="keep"]');
    if (keep) keep.focus();
    return;
  }
  if (act === 'keep') {
    state.listConfirm = null;
    renderList();
    var del = els.listBody.querySelector('.li[data-id="' + id + '"] [data-list="del"]');
    if (del) del.focus();
    return;
  }
  if (act === 'remove') { removeItem(id); return; }
  if (act === 'expand') {
    state.expand[id] = !state.expand[id];
    renderList();
    var b = els.listBody.querySelector('.li[data-id="' + id + '"] [data-list="expand"]');
    if (b) b.focus();
    return;
  }
  if (act === 'copy-all') { copyText(listPlainText(), function () { toast(state.list.length + ' citations copied.'); }); return; }
  if (act === 'export-md') { exportText('md'); return; }
  if (act === 'export-txt') { exportText('txt'); return; }
  if (act === 'clear') {
    state.listConfirm = 'clear';
    renderList();
    var k = els.listActionsWrap.querySelector('[data-list="keep"]');
    if (k) k.focus();
    return;
  }
  if (act === 'clear-yes') {
    state.list = [];
    state.listConfirm = null;
    saveList();
    renderList();
    renderOutputs();
    toast('List cleared.');
    announceList('List cleared.');
    els.listTitle.focus();
    return;
  }
  if (act === 'select-all') {
    var pre = btn.closest('.export-fallback').querySelector('pre');
    var range = document.createRange();
    range.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  if (act === 'dismiss') { var box = btn.closest('.export-fallback'); if (box) box.remove(); }
}

function resetPrefs() {
  try { window.localStorage.removeItem(KEYS.prefs); window.localStorage.removeItem(KEYS.list); } catch (e) {}
  state.program = 'ib'; state.course = 'ib-general'; state.strictness = 'mixed';
  state.activeStyle = 'mla'; state.tabOwned = false;
  state.answers = {}; state.form = blankForm(); state.list = []; state.askFirst = false;
  init();
  toast('Settings reset.');
}

/* -- form fields ----------------------------------------------------------- */
function toggleAdvanced() {
  state.advancedOpen = !state.advancedOpen;
  els.advToggle.setAttribute('aria-expanded', state.advancedOpen ? 'true' : 'false');
  els.advanced.hidden = !state.advancedOpen;
  els.advLabel.textContent = state.advancedOpen ? 'More details — close' : 'More details — optional: content type, edits, model version, tool name';
  if (state.advancedOpen) {
    var focusable = els.advanced.querySelector('select, input');
    if (focusable) focusable.focus();
  }
}
function onHarnessChange() {
  var f = state.form;
  f.harnessId = els.harness.value;
  var h = harnessById(f.harnessId);
  els.harnessCustomWrap.hidden = !(h && (h.id === 'other' || h.id === 'local'));
  els.harnessHelp.hidden = !!f.harnessId;
  if (h && h.fixed) { f.familyId = h.fixed; if (els.family) els.family.value = h.fixed; }
  else if (!h) { f.familyId = ''; }
  renderModelLine();
  reinstate();
}
function counterText(v) { return v.length.toLocaleString('en-US') + ' characters — the annex keeps all of it.'; }

function onPromptInput() {
  var t = els.prompt;
  if (t.value.length > PROMPT_MAX) { t.value = t.value.slice(0, PROMPT_MAX); toast('Trimmed to the first 20,000 characters.'); }
  state.form.prompt = t.value;
  els.promptRequired.hidden = true;
  t.removeAttribute('aria-invalid');
  if (t.value.length >= LONG_PROMPT) { els.promptCounter.hidden = false; els.promptCounter.textContent = counterText(t.value); }
  else els.promptCounter.hidden = true;
  scheduleForm();
  updateMobileReveal();
}

var formTimer = null, modelTimer = null;
function scheduleForm() {
  clearTimeout(formTimer);
  formTimer = setTimeout(function () { renderModelLine(); updateUrlNotes(); reinstate(); }, 120);
}
function scheduleModelPreview() {
  clearTimeout(modelTimer);
  modelTimer = setTimeout(function () { renderModelLine(); reinstate(); }, 300);
}
function updateEditsCounter() { els.editsCounter.hidden = (state.form.edits || '').length <= 200; }

/* 9 ------------------------------------------------------------------ Init */

function cacheEls() {
  ['program-note:programNote', 'course-note:courseNote', 'seg-blurb:segBlurb', 'section-a-desc:sectionADesc',
   'warnings:warnings', 'verdict-panel:verdictPanel', 'verdict-rail:verdictRail', 'verdict-inline:verdictInline',
   'sheet-body:sheetBody', 'verdict-live:verdictLive', 'copy-live:copyLive', 'list-live:listLive', 'toast:toast',
   'vbar:vbar', 'vbar-eyebrow:vbarEyebrow', 'vbar-title:vbarTitle', 'verdict-sheet:sheet', 'sheet-title:sheetTitle',
   'sheet-backdrop:backdrop', 'output-stack:outputStack', 'print-sheet:printSheet', 'list-body:listBody',
   'list-actions-wrap:listActionsWrap', 'list-count:listCount', 'list-title:listTitle', 'prompt:prompt',
   'prompt-counter:promptCounter', 'prompt-required:promptRequired', 'harness:harness',
   'harness-custom:harnessCustom', 'harness-custom-wrap:harnessCustomWrap',
   'harness-custom-help:harnessCustomHelp', 'harness-help:harnessHelp', 'family:family',
   'family-custom:familyCustom', 'family-custom-wrap:familyCustomWrap', 'family-wrap:familyWrap',
   'model-line:modelLine', 'model-preview:modelPreview', 'model-name:modelName', 'date:date', 'date-help:dateHelp', 'url:url', 'url-help:urlHelp',
   'url-public:urlPublic', 'url-warn:urlWarn', 'url-style:urlStyle', 'content-type:contentType', 'edits:edits', 'edits-counter:editsCounter',
   'include-harness:includeHarness', 'include-harness-help:includeHarnessHelp', 'adv-toggle:advToggle',
   'adv-label:advLabel', 'advanced:advanced', 'show-output:showOutput', 'ready-count:readyCount',
   'course:courseSelect', 'style-pick:stylePick', 'style-help:styleHelp', 'lang:lang', 'strictness-field:strictnessField', 'program-field:programField',
   'theme-toggle:themeToggle', 'theme-label:themeLabel', 'reset-prefs:resetPrefs', 'reset-help:resetHelp',
   'storage-notice-wrap:storageWrap', 'rows-a:rowsA', 'rows-b1:rowsB1', 'rows-b2:rowsB2',
   'rows-b3:rowsB3'
  ].forEach(function (pair) {
    var bits = pair.split(':');
    els[bits[1]] = q(bits[0]);
  });
}

function captureRows() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-item]'), function (node) {
    var id = node.getAttribute('data-item');
    rowRecs[id] = { node: node, parent: node.parentNode, marker: document.createComment(id) };
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var dark = theme === 'dark';
  els.themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  els.themeLabel.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
  try { window.localStorage.setItem(KEYS.theme, theme); } catch (e) {}
}

/* One verdict surface per width (UX §9.2): the panel is moved, never duplicated. */
function placeVerdict() {
  var w = window.innerWidth;
  var target = w < 900 ? els.sheetBody : (w < 1024 ? els.verdictInline : els.verdictRail);
  if (els.verdictPanel.parentNode !== target) target.appendChild(els.verdictPanel);
}

function measureSetup() {
  var bar = q('setup');
  if (bar) document.documentElement.style.setProperty('--setup-real-h', Math.round(bar.getBoundingClientRect().height) + 'px');
}

function storageNotice() {
  if (state.storageOK) return;
  els.storageWrap.innerHTML = '<div class="warn is-storage" role="note" aria-label="Storage notice">' +
    '<p class="warn-label">' + icon('i-alert') + '<span>NOT SAVED</span></p>' +
    '<p class="warn-body">This browser is not saving anything, so your list lasts until you close the tab. Everything else works. Export your list before you close the tab.</p>' +
    '<p><button type="button" class="btn-link" id="dismiss-storage">Dismiss</button></p></div>';
  els.resetPrefs.disabled = true;
  els.resetHelp.hidden = false;
  on(document.getElementById('dismiss-storage'), 'click', function () { els.storageWrap.innerHTML = ''; });
}

function loadPrefs() {
  var p = readJSON(KEYS.prefs, null);
  if (p && typeof p === 'object') {
    if (PROGRAMS.some(function (x) { return x.id === p.program; })) state.program = p.program;
    if (COURSES.some(function (x) { return x.id === p.course; })) state.course = p.course;
    if (STRICTNESS.some(function (x) { return x.id === p.strictness; })) state.strictness = p.strictness;
    if (STYLES.some(function (x) { return x.id === p.activeStyle; })) state.activeStyle = p.activeStyle;
    if (p.lang === 'en' || TRANSLATIONS[p.lang]) LANG = p.lang || 'en';
    state.tabOwned = !!p.tabOwned;
    if (p.form && typeof p.form === 'object') {
      Object.keys(state.form).forEach(function (k) { if (k in p.form) state.form[k] = p.form[k]; });
    }
  }
  var list = readJSON(KEYS.list, []);
  if (Object.prototype.toString.call(list) === '[object Array]') state.list = list.slice(0, LIST_MAX);
  if (!state.tabOwned) state.activeStyle = DEFAULT_TAB[state.program] || 'mla';
}

function fillControls() {
  var pi = els.programField.querySelector('input[value="' + state.program + '"]');
  if (pi) pi.checked = true;
  var si = els.strictnessField.querySelector('input[value="' + state.strictness + '"]');
  if (si) si.checked = true;
  els.courseSelect.value = state.course;
  els.harness.value = state.form.harnessId || '';
  els.family.value = state.form.familyId || '';
  els.prompt.value = state.form.prompt || '';
  els.date.value = state.form.date || todayISO();
  els.url.value = state.form.url || '';
  els.urlPublic.checked = !!state.form.urlPublic;
  els.contentType.value = state.form.contentType || 'outline';
  els.edits.value = state.form.edits || '';
  els.modelName.value = state.form.modelName || '';
  els.harnessCustom.value = state.form.harnessCustom || '';
  els.familyCustom.value = state.form.familyCustom || '';
  els.includeHarness.checked = state.form.includeHarness !== false;
  if (state.form.prompt && state.form.prompt.length >= LONG_PROMPT) {
    els.promptCounter.hidden = false;
    els.promptCounter.textContent = counterText(state.form.prompt);
  }
}

function wireEvents() {
  on(document, 'change', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('[data-check]')) { onCheckChange(t); return; }
    if (t.name === 'program') {
      state.program = t.value;
      if (!state.tabOwned) state.activeStyle = DEFAULT_TAB[state.program] || 'mla';
      renderAll();
      return;
    }
    if (t.name === 'strictness') { state.strictness = t.value; renderAll(); return; }
    if (t.name === 'style') { setStyle(t.value); return; }
    if (t === els.lang) { applyLanguage(t.value); return; }
    if (t === els.courseSelect) { state.course = t.value; renderAll(); return; }
    if (t === els.date) {
      state.form.date = t.value || '';
      els.dateHelp.hidden = !!parseISO(t.value);
      reinstate();
      return;
    }
    if (t === els.harness) { onHarnessChange(); return; }
    if (t === els.family) { state.form.familyId = t.value; renderModelLine(); reinstate(); return; }
    if (t === els.urlPublic) { state.form.urlPublic = t.checked; reinstate(); return; }
    if (t === els.includeHarness) { state.form.includeHarness = t.checked; renderModelLine(); reinstate(); return; }
    if (t.id === 'chicago-optin') { state.form.chicagoForceBib = t.checked; reinstate(); return; }
    if (t === els.contentType) { state.form.contentType = t.value; state.form.contentTypeOwned = true; reinstate(); return; }
  });

  on(document, 'input', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t === els.prompt) { onPromptInput(); return; }
    if (t === els.url) { state.form.url = t.value; scheduleForm(); return; }
    if (t === els.harnessCustom) {
      state.form.harnessCustom = t.value;
      els.harnessCustomHelp.hidden = !!collapseSpaces(t.value);
      scheduleForm();
      return;
    }
    if (t === els.familyCustom) { state.form.familyCustom = t.value; scheduleModelPreview(); return; }
    if (t === els.modelName) { state.form.modelName = t.value; scheduleModelPreview(); return; }
    if (t === els.edits) { state.form.edits = t.value; updateEditsCounter(); scheduleForm(); }
  });

  on(document, 'blur', function (e) {
    var t = e.target;
    if (t === els.prompt) {
      state.touched.prompt = true;
      els.promptRequired.hidden = !!collapseSpaces(t.value);
      if (!collapseSpaces(t.value)) t.setAttribute('aria-invalid', 'true');
      else t.removeAttribute('aria-invalid');
    }
    if (t === els.harness && !t.value) els.harnessHelp.hidden = false;
    if (t === els.url) {
      if (t.value && t.value.indexOf('://') < 0) { t.value = normaliseUrl(t.value); state.form.url = t.value; scheduleForm(); }
      els.urlHelp.hidden = !(t.value && t.value.indexOf('.') < 0);
    }
  }, true);

  on(document, 'click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#theme-toggle')) {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      return;
    }
    if (t.closest('#adv-toggle')) { toggleAdvanced(); return; }
    if (t.closest('#show-output')) {
      scrollToEl(els.outputStack);
      var panel = els.outputStack.querySelector('.output-panel');
      if (panel) panel.focus();
      return;
    }
    if (t.closest('#vbar')) { openSheet(); return; }
    if (t.closest('#sheet-close') || t.closest('#sheet-backdrop')) { closeSheet(); return; }
    if (t.closest('#reset-prefs')) { resetPrefs(); return; }

    var acc = t.closest('.acc-btn');
    if (acc) { openAccordion(acc.id); return; }
    var tab = t.closest('[data-tab]');
    if (tab) { setStyle(tab.getAttribute('data-tab')); tab.focus(); return; }
    var copy = t.closest('[data-copy]');
    if (copy) { copyBlock(copy.getAttribute('data-copy')); return; }
    var act = t.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'add') addToList();
      else if (a === 'print') window.print();
      else panelAction(a);
      return;
    }
    var listBtn = t.closest('[data-list]');
    if (listBtn) { listAction(listBtn); return; }
    if (t.closest('a[href^="#"]')) closeSheet();
  });

  on(document, 'keydown', function (e) {
    var tabEl = e.target.closest ? e.target.closest('[data-tab]') : null;
    if (tabEl) {
      var ids = STYLES.map(function (s) { return s.id; }), i = ids.indexOf(state.activeStyle), next = null;
      if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
      else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
      else if (e.key === 'Home') next = ids[0];
      else if (e.key === 'End') next = ids[ids.length - 1];
      if (next) {
        e.preventDefault();
        setStyle(next);
        var nt = document.getElementById('tab-' + next);
        if (nt) nt.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (state.sheetOpen) { closeSheet(); return; }
      if (state.listConfirm) {
        state.listConfirm = null;
        renderList();
        var d = els.listBody.querySelector('[data-list="del"]');
        if (d) d.focus();
      }
      return;
    }
    /* aria-disabled reorder ends stay focusable and announce instead of acting */
    if (e.key === 'Enter' || e.key === ' ') {
      var target = e.target;
      if (target.getAttribute && target.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        announceList(target.getAttribute('data-list') === 'up' ? 'Already at the top.' : 'Already at the bottom.');
      }
    }
  });

  on(document, 'submit', function (e) { e.preventDefault(); });
  on(window, 'resize', debounce(function () { placeVerdict(); measureSetup(); updateMobileReveal(); }, 120));
}

function init() {
  cacheEls();
  renderSurvey();
  renderHarnessOptions();
  renderStylePick();
  state.storageOK = storageProbe();
  state.form = blankForm();
  loadPrefs();
  captureRows();
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  fillControls();
  placeVerdict();
  measureSetup();
  storageNotice();
  wireEvents();

  state.verdict = computeVerdict(currentVerdictInput());
  lastLevel = state.verdict.level;
  renderSetup();
  syncChecklistRows();
  updateCheckUI();
  renderVerdict();
  renderOutputs();
  renderModelLine();
  renderList();
  document.documentElement.lang = LANG;
  if (els.lang) els.lang.value = LANG;
  translateDom(document.body);
  showPolicyLangNote();
  updateEditsCounter();
  updateMobileReveal();
  savePrefs();
}

/* --------------------------------------------------------------- Public API */

var API = {
  normaliseModel: normaliseModel,
  promptShort: promptShort,
  promptCiteWords: citeWords,
  deriveChatTitle: deriveChatTitle,
  formatDate: formatDate,
  normaliseUrl: normaliseUrl,
  mlaLocation: mlaLocation,
  formatMLA: formatMLA,
  formatAPA: formatAPA,
  formatChicagoNB: formatChicagoNB,
  formatChicagoAD: formatChicagoAD,
  formatIB: formatIB,
  computeVerdict: computeVerdict,
  buildDisclosure: buildDisclosure,
  buildAnnex: buildAnnex,
  escapeHtml: escapeHtml,
  constants: {
    PROGRAMS: PROGRAMS, COURSES: COURSES, STRICTNESS: STRICTNESS, FLAGS: FLAGS,
    HARNESSES: HARNESSES, FAMILIES: FAMILIES, STYLES: STYLES
  }
};

if (typeof window !== 'undefined') window.ClearCite = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
