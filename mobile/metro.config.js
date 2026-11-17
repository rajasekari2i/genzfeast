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
//
// Matched against the directory path itself (metro-file-map filters the
// crawl with `filterDir`), so the `(\/|$)` tail is load-bearing: without
// it the `build` directory is still watched, only its children are
// skipped. Deliberately not anchored to `node_modules/<pkg>/` — a
// `[^/]+` package segment never matches a SCOPED package
// (`@react-native-clipboard/clipboard` contains a slash), which let that
// package's intermediates through and blew the watcher limit anyway.
config.resolver.blockList = /\/android\/(build|\.gradle|\.cxx)(\/|$)/;

module.exports = withNativeWind(config, { input: './global.css' });
