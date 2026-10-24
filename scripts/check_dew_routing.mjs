// Run: node scripts/check_dew_routing.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent } from '../frontend/src/js/dewroute.js';

const questions = [
  'मुझे क्या करना चाहिए?',
  'मुझे पौधों की बीमारी में मदद चाहिए',
  'पौधोंना वाचवायला मला काय करायला पाहिजे?',
  'मेरे पौधे सूख रहे हैं, क्या पानी देना चाहिए?',
  'पाणी किती द्यायचे?',
  'Can I mix these products on my tomatoes?',
  'Does sunlight mean I need to repeat the dose?',
];
for (const q of questions) assert.equal(guideIntent(q), null, q);
for (const q of ['What can you do?', '  WHAT can you do?! ', 'आप क्या कर सकते हो?', 'आप क्या कर सकते हैं?', 'तू काय करू शकतोस?', 'तुम्ही काय करू शकता?'])
  assert.equal(guideIntent(q), 'what', q);
for (const [q, want] of [['Check a label', 'scan'], ['लेबल जाँचें', 'scan'], ['लेबल तपासा', 'scan'], ['Mix two products', 'mix'], ['दो प्रोडक्ट मिलाएँ', 'mix'], ['दोन प्रोडक्ट मिसळा', 'mix'], ['पाणी', 'water'], ['sunlight', 'sun'], ['नमस्ते!', 'greet'], ['धन्यवाद', 'thanks']])
  assert.equal(guideIntent(q), want, q);

// Exercise real reply() routing, not only the matcher. Stub UI and network.
let src = readFileSync(new URL('../frontend/src/js/dew.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/^export /mg, '')
  .replace(/function renderLog\(\) \{[\s\S]*?\n\}/, 'function renderLog() {}')
  .replace(/let ctx = .*;/, 'let ctx = {getContext:()=>({}),openScan:()=>recorded.push("scan"),openMix:()=>recorded.push("mix")};')
  .replace(/function say\(msg, chips = null, tag = null, quiet = false\) \{[\s\S]*?\n\}/, 'function say(msg, chips, tag, quiet) { recorded.push(txt(msg)); }')
  .replace(/async function aiReply\(text\) \{[\s\S]*?\n\}/, 'async function aiReply(text) { recorded.push("AI:"+text); }');
const recorded = [];
const sandbox = {guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent, recorded, localStorage:{getItem:()=> 'hi',setItem:()=>{}}, document:{getElementById:()=>({innerHTML:'',placeholder:''})}};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
for (const q of questions) {
  sandbox.input=q; vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), 'AI:'+q, q);
}
for (const l of ['en','hi','mr']) {
  sandbox.language=l;
  for (let i=0;i<4;i++) {
    sandbox.chip=i;
    vm.runInContext('lang=language; reply(L[lang].chips[chip]);',sandbox);
    assert.ok(!String(recorded.at(-1)).startsWith('AI:'),`${l} chip ${i}`);
  }
}
for (const [q, want] of [['क्या धूप Bt को नुकसान पहुँचाती है?', 'hi'], ['मेरे पौधे को नुकसान हुआ है', 'hi'], ['माझ्या झाडाला पाणी किती द्यायचे?', 'mr'], ['मला मदत पाहिजे', 'mr']]) {
  sandbox.input=q;
  assert.equal(vm.runInContext('detectLang(input)', sandbox), want, q);
}
console.log(`PASS: ${questions.length} full questions reach AI; explicit guides and all 12 chips preserved.`);

// Grounded caterpillar/Bt conversation: pest questions get the built-in
// sourced answer (never AI), follow-up procedure/timing questions answer from
// label directions, and a cold procedure question asks which product first.
const PEST_Q = {
  en: 'my farm is having too many caterpillars',
  hi: 'मेरे खेत में बहुत कैटरपिलर हैं',
  mr: 'माझ्या शेतात खूप अळ्या आहेत',
};
const HOW_Q = {
  en: 'what is the procedure and perfect time to spray',
  hi: 'कैसे और कब छिड़काव करें',
  mr: 'कसे आणि केव्हा फवारायचे',
};
const PEST_FACT = vm.runInContext('PEST_FACT', sandbox);
const SPRAY_GUIDE = vm.runInContext('SPRAY_GUIDE', sandbox);
const BT_FACT = vm.runInContext('BT_FACT', sandbox);
const Lset = vm.runInContext('L', sandbox);
for (const lg of ['en', 'hi', 'mr']) {
  vm.runInContext(`lang = "${lg}"; lastTopic = null;`, sandbox);
  recorded.length = 0;
  sandbox.input = PEST_Q[lg]; vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), PEST_FACT[lg], `${lg} pest answer`);
  sandbox.input = HOW_Q[lg]; vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), SPRAY_GUIDE[lg], `${lg} procedure follow-up`);
  // topic persists: bare timing follow-up also answers
  sandbox.input = { en: 'and the perfect time?', hi: 'और सही समय?', mr: 'आणि योग्य वेळ?' }[lg];
  vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), SPRAY_GUIDE[lg], `${lg} bare timing follow-up`);
  // Bt mechanism question (teacher-style), asked in the current language
  sandbox.input = { en: 'how does Bt work', hi: 'Bt कैसे काम करता है?', mr: 'Bt कसं काम करतं?' }[lg];
  vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), BT_FACT[lg], `${lg} bt mechanism`);
  // cold procedure question without any topic asks which product
  vm.runInContext('lastTopic = null;', sandbox);
  sandbox.input = HOW_Q[lg]; vm.runInContext('reply(input)', sandbox);
  assert.equal(recorded.at(-1), Lset[lg].whichProduct, `${lg} cold procedure asks product`);
  assert.ok(!recorded.some(r => String(r).startsWith('AI:')), `${lg}: nothing leaked to AI`);
}
console.log('grounded caterpillar conversation checks pass');

// Negative-context tests: the grounded handlers must NOT fire off-topic.
// 1) Non-caterpillar pest goes to AI, not PEST_FACT.
vm.runInContext('lang = "en"; lastTopic = null;', sandbox);
recorded.length = 0;
sandbox.input = 'my farm has too many aphids'; vm.runInContext('reply(input)', sandbox);
assert.ok(String(recorded.at(-1)).startsWith('AI:'), 'aphids must go to AI, got: ' + recorded.at(-1));
// 2) After a caterpillar question, a procedure question about a weedicide
//    must not get the Bt spray guide.
vm.runInContext('lang = "en"; lastTopic = null;', sandbox);
sandbox.input = PEST_Q.en; vm.runInContext('reply(input)', sandbox);
sandbox.input = 'and what is the right time to spray weedicide?'; vm.runInContext('reply(input)', sandbox);
assert.ok(String(recorded.at(-1)).startsWith('AI:'), 'weedicide timing must go to AI, got: ' + recorded.at(-1));
// 3) Same guard in Marathi: after pest context, fungicide procedure -> AI.
vm.runInContext('lang = "mr"; lastTopic = null;', sandbox);
sandbox.input = PEST_Q.mr; vm.runInContext('reply(input)', sandbox);
sandbox.input = 'बुरशीनाशक केव्हा फवारायचे?'; vm.runInContext('reply(input)', sandbox);
assert.ok(String(recorded.at(-1)).startsWith('AI:'), 'mr fungicide timing must go to AI, got: ' + recorded.at(-1));
// 4) Language code-switch: Marathi grammar + Latin "caterpillars" still
//    resolves to the Marathi grounded answer.
vm.runInContext('lang = "mr"; lastTopic = null;', sandbox);
recorded.length = 0;
sandbox.input = 'माझ्या शेतात खूप caterpillars आहेत'; vm.runInContext('reply(input)', sandbox);
assert.equal(recorded.at(-1), PEST_FACT.mr, 'code-switched pest question');
console.log('negative-context checks pass');
