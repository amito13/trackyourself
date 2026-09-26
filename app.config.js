module.exports = ({ config }) => {
  const isDevelopment = process.env.APP_VARIANT === "development";

  return {
    ...config,
    name: isDevelopment ? "OUTDO Dev" : config.name,
    scheme: isDevelopment ? "trackyourself-dev" : config.scheme,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
      package: isDevelopment
        ? `${config.android.package}.dev`
        : config.android.package,
    },
    plugins: [...(config.plugins ?? []), "expo-dev-client"],
  };
};
