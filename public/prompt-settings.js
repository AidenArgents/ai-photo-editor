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

  function pickPrompts(defaults, stored, mode) {
    const prompts = { ...defaults };
    const definition = definitions.get(mode);
    for (const key of Object.keys(defaults)) {
      const val = stored?.[key];
      const isOutdated20260908 = typeof val === 'string' && (
        val.includes('No automatic flags, cacti') ||
        val.includes('No automatic carnival') ||
        val.includes("Muted Tones','Warm Brown'") ||
        val.includes('你是顶尖电商AI商业摄影作图专家。请根据已确认的各图设计理念与任务') ||
        (key === 'aesthetic' && val.includes('Contemporary Mexican everyday life'))
      );
      const oldDefault = stored?.defaultsRevision !== definition?.revision && (
        val === definition?.legacy?.[key] || isOutdated20260908
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
