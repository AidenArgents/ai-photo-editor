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

const oldCategoryRules = JSON.stringify({
  general: '依据实际产品选择摄影和证据，不推断不存在的功能。',
  beauty: '准确表达包装、质地和有依据的使用方式；不虚构功效、成分、前后对比。',
  home: '真实尺度、材质、承重和使用关系；不虚构容量或配件。',
  fitness: '合理人体动作、结构和受力；不虚构减重或健康效果。',
  electronics: '准确接口、按键、线材和组件，不生成不存在的功能。',
});
const newCategoryRules = JSON.stringify({
  general: 'new general', beauty: 'new beauty', home: 'new home', fitness: 'new fitness', electronics: 'new electronics',
  baby_toys: 'new baby', pet_supplies: 'new pet', automotive_tools: 'new automotive', jewelry_accessories: 'new jewelry',
  outdoor_camping: 'new outdoor', home_improvement: 'new home improvement', garden_hardware: 'new garden', bedding_textiles: 'new bedding',
  household_cleaning: 'new cleaning', kitchen_dining: 'new kitchen', apparel_footwear_bags: 'new apparel',
});
const upgraded = createRuntime({
  'ai_photo_editor.prompts.taotu.v1': JSON.stringify({ categoryRules: oldCategoryRules, promptSchemaVersion: 1, defaultsRevision: '2026-09-08.4' }),
});
upgraded.api.registerDefaults('taotu', { categoryRules: newCategoryRules }, {}, '2026-09-10.2');
assert(upgraded.api.load('taotu', { categoryRules: newCategoryRules }).prompts.categoryRules === newCategoryRules, 'untouched legacy category defaults were not upgraded');
assert(upgraded.values.has('ai_photo_editor.prompts.taotu.v1.backup.2026-09-10.2'), 'category upgrade backup missing');

const customCategoryRules = JSON.stringify({ ...JSON.parse(oldCategoryRules), custom: '客户自定义类目' });
const customized = createRuntime({
  'ai_photo_editor.prompts.taotu.v1': JSON.stringify({ categoryRules: customCategoryRules, promptSchemaVersion: 1, defaultsRevision: '2026-09-08.4' }),
});
customized.api.registerDefaults('taotu', { categoryRules: newCategoryRules }, {}, '2026-09-10.2');
const mergedCategoryRules = JSON.parse(customized.api.load('taotu', { categoryRules: newCategoryRules }).prompts.categoryRules);
assert(mergedCategoryRules.custom === '客户自定义类目', 'custom category rules were overwritten');
assert(mergedCategoryRules.general === JSON.parse(oldCategoryRules).general, 'custom category values were overwritten');
assert(['baby_toys', 'pet_supplies', 'automotive_tools', 'jewelry_accessories', 'outdoor_camping', 'home_improvement', 'garden_hardware', 'bedding_textiles', 'household_cleaning', 'kitchen_dining', 'apparel_footwear_bags'].every((key) => mergedCategoryRules[key]), 'new categories were not merged into customized rules');
console.log('OK prompt settings migration and key isolation');
