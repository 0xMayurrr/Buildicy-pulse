const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports to prevent module resolution errors for Supabase on React Native
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
