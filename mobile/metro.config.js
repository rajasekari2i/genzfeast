const { getDefaultConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Gradle writes its native build intermediates INSIDE node_modules — this
// checkout carries ~4.3GB of them (reanimated alone is 2.5GB). Metro would
// otherwise crawl and watch every directory in there and exhaust
// fs.inotify.max_user_watches (65536 on a stock Linux box), which surfaces
// as `ENOSPC: System limit for number of file watchers reached` and kills
// the bundler at startup. None of it is JavaScript Metro could ever serve.
//
// Not using metro-config's own exclusionList helper: its subpath is not
// listed in that package's `exports` in this version, so requiring it
// throws ERR_PACKAGE_PATH_NOT_EXPORTED.
config.resolver.blockList = /\/node_modules\/[^/]+\/android\/build\/.*/;

module.exports = withNativeWind(config, { input: './global.css' });
