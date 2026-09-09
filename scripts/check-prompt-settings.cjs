const fs = require('node:fs');
const vm = require('node:vm');

function createRuntime(seed = {}) {
  const values = new Map(Object.entries(seed));
  const localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/prompt-settings.js', 'utf8'), {
    window,
    localStorage,
    console,
    Date,
  });
  return { api: window.AiPhotoPromptSettings, values };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const legacySuite = JSON.stringify({ concept: 'legacy-suite', kb: { demo: [] } });
const suite = createRuntime({ ecom_studio_prompts: legacySuite });
assert(suite.api.load('taotu', { concept: 'default' }).prompts.concept === 'legacy-suite', 'taotu legacy migration failed');
assert(suite.api.load('changjing', { concept: 'default' }).prompts.concept === 'legacy-suite', 'changjing legacy migration failed');
assert(suite.values.has('ai_photo_editor.prompts.taotu.v1'), 'taotu key missing');
assert(suite.values.has('ai_photo_editor.prompts.changjing.v1'), 'changjing key missing');

const legacyFba = JSON.stringify({ concept: 'legacy-fba', promptSchemaVersion: 3 });
const fba = createRuntime({ ecom_studio_prompts: legacyFba });
assert(fba.api.load('fba', { concept: 'default' }).prompts.concept === 'legacy-fba', 'fba v3 migration failed');
assert(fba.api.load('taotu', { concept: 'default' }).prompts.concept === 'default', 'fba settings leaked into taotu');

const clean = createRuntime();
for (const mode of ['taotu', 'zhutu', 'changjing', 'fba']) clean.api.save(mode, { prompt: mode }, null);
const keys = ['taotu', 'zhutu', 'changjing', 'fba'].map((mode) => clean.api.getStorageKey(mode));
assert(new Set(keys).size === 4, 'mode storage keys are not independent');
console.log('OK prompt settings migration and key isolation');
