const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withKotlinJvmWarning(config) {
  return withGradleProperties(config, (mod) => {
    const key = "kotlin.jvm.target.validation.mode";
    mod.modResults = mod.modResults.filter((item) => item.key !== key);
    mod.modResults.push({ type: "property", key, value: "warning" });
    return mod;
  });
};
