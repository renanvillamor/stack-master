const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Some packages (e.g. zustand v5's `middleware` entry) only guard their
// Vite-style `import.meta.env` usage behind the package.json "exports"
// map's "react-native" condition, not "browser" — Metro's web platform
// requests only ["browser"] by default, so it falls through to the raw
// ESM build and `import.meta` blows up parsing the bundle (the app never
// hydrates on web). Accepting "react-native" as well on web routes those
// packages to their safe CJS build there too.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [...(config.resolver.unstable_conditionsByPlatform?.web ?? []), 'react-native'],
};

module.exports = withNativeWind(config, { input: './global.css' });
