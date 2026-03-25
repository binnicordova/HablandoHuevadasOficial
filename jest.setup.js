// Mocking global winter features that might be causing issues in Jest
global.__ExpoImportMetaRegistry = {};
global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
