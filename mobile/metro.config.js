// metro.config.js
// EAS Linux cannot load this file if NativeWind/Vibecode throw at require-time.

console.log("[Metro Config] boot", process.version, {
  eas: process.env.EAS_BUILD,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
  gradle: Boolean(process.env.GRADLE_USER_HOME),
});

const path = require("path");
const fs = require("fs");

const skipHeavy =
  process.env.EAS_BUILD === "true" ||
  process.env.CI === "true" ||
  Boolean(process.env.GRADLE_USER_HOME);

function safeRequire(id) {
  try {
    return require(id);
  } catch (e) {
    console.error("[Metro Config] require failed:", id);
    console.error(e && (e.stack || e));
    return null;
  }
}

const expoMetro = safeRequire("expo/metro-config");
if (!expoMetro || !expoMetro.getDefaultConfig) {
  throw new Error("[Metro Config] expo/metro-config failed to load");
}
const { getDefaultConfig } = expoMetro;

let withNativeWind = (config) => config;
const nativeWindMod = safeRequire("nativewind/metro");
if (nativeWindMod && nativeWindMod.withNativeWind) {
  withNativeWind = nativeWindMod.withNativeWind;
} else {
  console.warn("[Metro Config] nativewind/metro unavailable, continuing without it");
}

let withVibecodeMetro = (config) => config;
if (!skipHeavy) {
  const vibe = safeRequire("@vibecodeapp/sdk/metro");
  if (vibe && vibe.withVibecodeMetro) {
    withVibecodeMetro = vibe.withVibecodeMetro;
  }
}

const skipVibecode = skipHeavy;

/** @type {import('expo/metro-config').MetroConfig} */
let config = getDefaultConfig(__dirname);

const sharedFolder = path.resolve(__dirname, "../shared");
const sharedFolderExists = fs.existsSync(sharedFolder);

console.log("[Metro Config] Version: 2026-08-31-eas-safe-require");
console.log(`[Metro Config] Shared folder: ${sharedFolder}`);
console.log(`[Metro Config] Shared folder exists: ${sharedFolderExists}`);
console.log("[Metro Config] skipHeavy:", skipHeavy);

if (sharedFolderExists) {
  config.watchFolders = [sharedFolder];
}

config.resolver.useWatchman = false;

const { assetExts, sourceExts } = config.resolver;

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

config.resolver = {
  ...config.resolver,
  assetExts: assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...sourceExts, "svg"],
  useWatchman: false,
  ...(sharedFolderExists && {
    unstable_enablePackageExports: true,
    extraNodeModules: {
      ...config.resolver.extraNodeModules,
      "@/shared": sharedFolder,
    },
    nodeModulesPaths: [
      path.resolve(__dirname, "node_modules"),
      path.resolve(__dirname, "../backend/node_modules"),
    ],
  }),
  resolveRequest: (context, moduleName, platform) => {
    if (sharedFolderExists && moduleName.startsWith("@/shared/")) {
      const subpath = moduleName.slice("@/shared/".length);
      const resolvedPath = path.join(sharedFolder, subpath);
      return context.resolveRequest(context, resolvedPath, platform);
    }

    if (sharedFolderExists && moduleName === "@/shared") {
      return context.resolveRequest(context, sharedFolder, platform);
    }

    if (sharedFolderExists && !context.originModulePath?.includes("node_modules")) {
      const relativeSharedMatch = moduleName.match(/^(?:\.\.\/)+shared\/(.+)$/);
      if (relativeSharedMatch) {
        const subpath = relativeSharedMatch[1];
        const resolvedPath = path.join(sharedFolder, subpath);
        return context.resolveRequest(context, resolvedPath, platform);
      }
    }

    if (moduleName.includes("better-auth") && moduleName.endsWith(".cjs")) {
      const mjsPath = moduleName.replace(/\.cjs$/, ".mjs");
      return context.resolveRequest(context, mjsPath, platform);
    }

    if (
      moduleName.includes("async-require") &&
      (moduleName.includes("@expo/metro-config") ||
        moduleName.includes("metro-config/build/async-require"))
    ) {
      return context.resolveRequest(
        context,
        require.resolve("expo/internal/async-require-module"),
        platform,
      );
    }

    if (platform === "web") {
      const nativeOnlyModules = [
        "react-native-pager-view",
        "reanimated-tab-view",
        "@bottom-tabs/react-navigation",
      ];
      if (nativeOnlyModules.some((mod) => moduleName.includes(mod))) {
        return { type: "empty" };
      }
    }

    return context.resolveRequest(context, moduleName, platform);
  },
};

if (skipVibecode) {
  try {
    config.transformer = {
      ...config.transformer,
      babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
    };
  } catch (e) {
    console.warn("[Metro Config] SVG transformer skipped:", e && e.message);
  }
} else {
  config = withVibecodeMetro(config);
}

try {
  module.exports = withNativeWind(config, {
    input: path.join(__dirname, "global.css"),
  });
} catch (e) {
  console.error("[Metro Config] withNativeWind failed, exporting base config", e);
  module.exports = config;
}
