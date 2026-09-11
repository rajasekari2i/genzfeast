module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Must be last — compiles Reanimated 4 worklets (babel-preset-expo used
    // to inject this automatically; the bare preset does not).
    plugins: ['react-native-worklets/plugin'],
  };
};
