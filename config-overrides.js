const webpack = require("webpack");

module.exports = function override(config, env) {
  config.resolve.fallback = {
    crypto: require.resolve("crypto-browserify"),
    vm: false,
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
  };

  // Add Buffer and process to the global scope
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ];

  config.ignoreWarnings = [
    /*
        Ignores errors of the format
        WARNING in ./node_modules/@magenta/music/esm/spice/model.js
        Module Warning (from ./node_modules/source-map-loader/dist/cjs.js):
        Failed to parse source map from '[...]node_modules/@magenta/music/src/spice/model.ts' file: Error:
           ENOENT: no such file or directory, open '[...]node_modules/@magenta/music/src/spice/model.ts'
        for any @magenta/music or @inrupt/solid-ui-react modules.
        */
    function ignoreSourceMapWarning(warning) {
      if (
        warning.message &&
        warning.message.includes("Failed to parse source map")
      ) {
        if (warning.message.includes("@inrupt/")) {
          return true;
        }
        if (warning.message.includes("@magenta/")) {
          return true;
        }
      }

      return false;
    },
  ];
  // https://github.com/axios/axios/issues/6571
  config.module.rules.push({
    test: /\.m?js/,
    resolve: { fullySpecified: false },
  });

  // Webpack's persistent filesystem cache treats everything under node_modules/
  // as immutable and only re-validates a package by its package.json version.
  // meld-clients-core is often replaced by a symlink to a local checkout
  // (`npm link ../meld-clients-core`) and rebuilt in place, and its version
  // never changes, so webpack would keep serving a stale copy. Exclude it from
  // the managed set so its files are snapshotted by mtime like project source,
  // whether it is symlinked or installed from git. The cost is a stat of a few
  // hundred files at startup.
  config.snapshot = {
    ...config.snapshot,
    managedPaths: [/^(.+?[\\/]node_modules[\\/](?!meld-clients-core[\\/]))/],
  };

  return config;
};
