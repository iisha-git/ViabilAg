import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenText, speechParts, speechMood, chooseVoice} from '../src/js/dewspeech.js';
test('duplicate Latin expansion and citations are not recited', () => {
  assert.equal(spokenText('Bt (Bacillus thuringiensis) may help [1].'), 'bee tee may help.');
  assert.equal(spokenText('Bt [Bacillus thuringiensis].'), 'bee tee.');
  assert.equal(spokenText('No mixing.No guessing.'), 'No mixing. No guessing.');
  assert.equal(spokenText('**Read** [the label](https://example.org/label) [pause].'), 'Read the label.');
});
test('parenthetical restrictions, dose numbers and negatives survive', () => {
  const s = spokenText('Do not mix (unless the label permits it). pH 6.5-7.0 is not proof of safety.');
  assert.equal(s, 'Do not mix, unless the label permits it. pee aitch 6.5-7.0 is not proof of safety.');
  assert.equal(spokenText('Never use (2 ml per litre) without label approval.'), 'Never use, 2 ml per litre, without label approval.');
});
test('HI/MR pronunciation and sentence boundaries', () => {
  for (const lang of ['hi', 'mr']) {
    assert.equal(spokenText('Bt (Bacillus thuringiensis)।', lang), 'बी टी।');
    assert.deepEqual(speechParts('पहले लेबल जाँचें। मात्रा का अंदाज़ा नहीं लगाऊँगा।'), ['पहले लेबल जाँचें।', 'मात्रा का अंदाज़ा नहीं लगाऊँगा।']);
  }
});
test('lists are speech, decimals are not sentence breaks, no lost ending', () => {
  assert.equal(spokenText('1) Read. 2) Do not guess.'), 'Read. Do not guess.');
  assert.deepEqual(speechParts('pH 6.5 matters. Do not guess.'), ['pH 6.5 matters.', 'Do not guess.']);
  const text = 'word '.repeat(500) + 'Do not mix.';
  assert.equal(speechParts(text).join(' '), text.trim());
  assert.ok(speechParts(text).every(x => x.length <= 260));
});
test('concern is not given a celebratory face', () => {
  assert.equal(speechMood('Do not mix.'), 'unsure');
  assert.equal(speechMood('Which crop?'), 'think');
});
test('voice selection stays in language and local', () => {
  const voices = [{name:'network',lang:'mr-IN',localService:false},{name:'Hindi',lang:'hi-IN',localService:true},{name:'Marathi',lang:'mr-IN',localService:true}];
  assert.equal(chooseVoice(voices, 'mr-IN').name,'Marathi');
  assert.equal(chooseVoice(voices, 'en-IN'), undefined);
});
