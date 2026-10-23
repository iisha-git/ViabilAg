// Run: node scripts/check_dew_routing.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guideIntent } from '../frontend/src/js/dewroute.js';

const questions = [
  'कैटरपिलर से पौधों को बचाने के लिए मुझे क्या करना चाहिए',
  'व्हाट शोल्ड ई डू टू प्रिवेंट कैटरपिलर ऑन माय प्लांट्स',
  'मुझे क्या करना चाहिए?',
  'How can you help me protect plants from caterpillars?',
  'मुझे पौधों की बीमारी में मदद चाहिए',
  'पौधोंना वाचवायला मला काय करायला पाहिजे?',
  'मला अळ्यांपासून झाडे वाचवायला मदत करा',
  'मेरे पौधे सूख रहे हैं, क्या पानी देना चाहिए?',
  'पाणी किती द्यायचे?',
  'क्या इस लेबल पर लिखा उत्पाद कैटरपिलर के लिए है?',
  'Can I mix these products on my tomatoes?',
  'Does sunlight mean I need to repeat the dose?',
  'नमस्ते, मुझे कैटरपिलर से पौधों को बचाने के लिए क्या करना चाहिए?',
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
  .replace(/function say\(msg, chips = null, tag = null\) \{[\s\S]*?\n\}/, 'function say(msg) { recorded.push(txt(msg)); }')
  .replace(/async function aiReply\(text\) \{[\s\S]*?\n\}/, 'async function aiReply(text) { recorded.push("AI:"+text); }');
const recorded = [];
const sandbox = {guideIntent, recorded, localStorage:{getItem:()=> 'hi',setItem:()=>{}}, document:{getElementById:()=>({innerHTML:'',placeholder:''})}};
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
