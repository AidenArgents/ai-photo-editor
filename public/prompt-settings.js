(function () {
  'use strict';
  const definitions = new Map();

  const MODES = Object.freeze({
    taotu: {
      storageKey: 'ai_photo_editor.prompts.taotu.v1',
      schemaVersion: 1,
      legacyKeys: ['ecom_studio_prompts'],
      acceptLegacy: (value) => !value?.promptSchemaVersion,
    },
    zhutu: {
      storageKey: 'ai_photo_editor.prompts.zhutu.v1',
      schemaVersion: 1,
      legacyKeys: ['ecom_main_prompts'],
      acceptLegacy: () => true,
    },
    changjing: {
      storageKey: 'ai_photo_editor.prompts.changjing.v1',
      schemaVersion: 1,
      legacyKeys: ['ecom_studio_prompts'],
      acceptLegacy: (value) => !value?.promptSchemaVersion,
    },
    fba: {
      storageKey: 'ai_photo_editor.prompts.fba.v3',
      schemaVersion: 3,
      legacyKeys: ['ecom_studio_prompts'],
      acceptLegacy: (value) => Number(value?.promptSchemaVersion) === 3,
    },
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function parseStored(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function getMode(mode) {
    const config = MODES[mode];
    if (!config) throw new Error(`Unknown prompt settings mode: ${mode}`);
    return config;
  }

  const LEGACY_CATEGORY_RULES_20260908 = Object.freeze({
    general: '依据实际产品选择摄影和证据，不推断不存在的功能。',
    beauty: '准确表达包装、质地和有依据的使用方式；不虚构功效、成分、前后对比。',
    home: '真实尺度、材质、承重和使用关系；不虚构容量或配件。',
    fitness: '合理人体动作、结构和受力；不虚构减重或健康效果。',
    electronics: '准确接口、按键、线材和组件，不生成不存在的功能。',
  });

  function isLegacyBuiltInCategoryRules(value) {
    if (typeof value !== 'string') return false;
    try {
      const parsed = JSON.parse(value);
      const expectedKeys = Object.keys(LEGACY_CATEGORY_RULES_20260908);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        Object.keys(parsed).length === expectedKeys.length &&
        expectedKeys.every((key) => parsed[key] === LEGACY_CATEGORY_RULES_20260908[key]);
    } catch (_) {
      return false;
    }
  }

  function addMissingCategoryRules(value, defaultValue) {
    if (typeof value !== 'string' || typeof defaultValue !== 'string') return value;
    try {
      const parsed = JSON.parse(value);
      const defaults = JSON.parse(defaultValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return value;
      let changed = false;
      for (const key of ['baby_toys', 'pet_supplies', 'automotive_tools', 'jewelry_accessories', 'outdoor_camping', 'home_improvement', 'garden_hardware', 'bedding_textiles', 'household_cleaning', 'kitchen_dining', 'apparel_footwear_bags']) {
        if (Object.hasOwn(parsed, key) || !Object.hasOwn(defaults, key)) continue;
        parsed[key] = defaults[key];
        changed = true;
      }
      return changed ? JSON.stringify(parsed, null, 2) : value;
    } catch (_) {
      return value;
    }
  }

  function pickPrompts(defaults, stored, mode) {
    const prompts = { ...defaults };
    const definition = definitions.get(mode);
    for (const key of Object.keys(defaults)) {
      const storedValue = stored?.[key];
      const legacyCategoryRules = key === 'categoryRules' && isLegacyBuiltInCategoryRules(storedValue);
      const val = key === 'categoryRules' && stored?.defaultsRevision !== definition?.revision && !legacyCategoryRules
        ? addMissingCategoryRules(storedValue, defaults[key])
        : storedValue;
      const isOutdated20260908 = typeof val === 'string' && (
        val.includes('No automatic flags, cacti') ||
        val.includes('No automatic carnival') ||
        val.includes("Muted Tones','Warm Brown'") ||
        val.includes('你是顶尖电商AI商业摄影作图专家。请根据已确认的各图设计理念与任务') ||
        (key === 'aesthetic' && val.includes('Contemporary Mexican everyday life'))
      );
      const oldDefault = stored?.defaultsRevision !== definition?.revision && (
        val === definition?.legacy?.[key] || isOutdated20260908 ||
        legacyCategoryRules
      );
      if (typeof val === 'string' && !oldDefault) prompts[key] = val;
    }
    return prompts;
  }

  function persist(mode, prompts, kb, extra) {
    const config = getMode(mode);
    const definition = definitions.get(mode);
    const overrides = Object.fromEntries(Object.entries(prompts).filter(([key, value]) => typeof value === 'string' && value !== definition?.defaults?.[key]));
    const payload = {
      ...overrides,
      ...(kb && typeof kb === 'object' ? { kb } : {}),
      promptSchemaVersion: config.schemaVersion,
      savedAt: new Date().toISOString(),
      defaultsRevision: definition?.revision || null,
      ...(extra && typeof extra === 'object' ? extra : {}),
    };
    localStorage.setItem(config.storageKey, JSON.stringify(payload));
    return payload;
  }

  function load(mode, defaults) {
    const config = getMode(mode);
    let stored = parseStored(localStorage.getItem(config.storageKey));
    let migratedFrom = '';

    if (!stored) {
      for (const legacyKey of config.legacyKeys) {
        const legacy = parseStored(localStorage.getItem(legacyKey));
        if (!legacy || !config.acceptLegacy(legacy)) continue;
        stored = legacy;
        migratedFrom = legacyKey;
        try {
          persist(mode, pickPrompts(defaults, legacy, mode), legacy.kb, {
            migratedFrom: legacyKey,
          });
        } catch (_) {
          // Loading legacy settings is still useful when storage is unavailable.
        }
        break;
      }
    }

    const definition = definitions.get(mode);
    let prompts = pickPrompts(defaults, stored, mode);
    let archivedRecognition = stored?.archivedRecognition || '';
    if (stored && definition && stored.defaultsRevision !== definition.revision && !stored.resetAt) {
      // Keep the exact old payload recoverable before changing its interpretation.
      const backupKey = config.storageKey + '.backup.' + definition.revision;
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify(stored));
      if (typeof stored.recognize === 'string' && /main color|color name\(s\)|under 5 words/i.test(stored.recognize)) {
        archivedRecognition = stored.recognize;
        prompts.recognize = defaults.recognize;
      }
      persist(mode, prompts, stored.kb, { archivedRecognition, migratedFrom: migratedFrom || config.storageKey });
    }
    return {
      prompts,
      kb: stored?.kb && typeof stored.kb === 'object' ? clone(stored.kb) : null,
      storageKey: config.storageKey,
      migratedFrom,
      archivedRecognition,
    };
  }

  function reset(mode) {
    // Keep a tombstone: removing the key would import the legacy settings again.
    const config = getMode(mode);
    localStorage.setItem(config.storageKey, JSON.stringify({
      promptSchemaVersion: config.schemaVersion,
      resetAt: new Date().toISOString(),
    }));
  }

  window.AiPhotoPromptSettings = Object.freeze({
    registerDefaults: (mode, defaults, legacy, revision) => definitions.set(mode, { defaults: clone(defaults), legacy: clone(legacy), revision }),
    load,
    save: persist,
    reset,
    getStorageKey: (mode) => getMode(mode).storageKey,
  });
})();
