const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const variant = process.argv[2] === "release" ? "Release" : "Debug";
const { expo } = require(path.join(projectRoot, "app.json"));

console.log(`Building Android APK locally (${variant})...`);

try {
  if (!fs.existsSync(androidDir)) {
    console.log("Running expo prebuild...");
    execSync("npx expo prebuild --platform android", {
      cwd: projectRoot,
      stdio: "inherit",
    });
  }

  const gradleCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  execSync(`${gradleCmd} assemble${variant}`, {
    cwd: androidDir,
    stdio: "inherit",
  });

  const outputDir = path.join(
    androidDir,
    "app",
    "build",
    "outputs",
    "apk",
    variant.toLowerCase(),
  );
  const apkPath = path.join(outputDir, `app-${variant.toLowerCase()}.apk`);

  if (fs.existsSync(apkPath)) {
    const renamedPath = path.join(
      outputDir,
      `${expo.name}-v${expo.version}-${variant.toLowerCase()}.apk`,
    );
    fs.renameSync(apkPath, renamedPath);
    console.log(`\nAPK ready: ${renamedPath}`);
  }
} catch (error) {
  process.exit(error.status ?? 1);
}
