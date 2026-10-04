/*
 * scripts/patch-manifest.js
 *
 * Inyecta los permisos Bluetooth en el AndroidManifest.xml que genera
 * `npx cap add android`. Se ejecuta en el CI (y se puede correr en local).
 * Es idempotente: si los permisos ya estan, no los duplica.
 */

const fs = require("fs");
const path = require("path");

const manifestPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml"
);

if (!fs.existsSync(manifestPath)) {
  console.error("No se encontro AndroidManifest.xml en " + manifestPath);
  console.error("Ejecuta primero: npx cap add android");
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, "utf8");

const permissions = [
  '<uses-permission android:name="android.permission.BLUETOOTH" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
];

// Solo agregamos las que falten.
const missing = permissions.filter((p) => {
  const permName = p.match(/android:name="([^"]+)"/)[1];
  return !xml.includes(permName);
});

if (missing.length === 0) {
  console.log("Todos los permisos Bluetooth ya estan presentes. Nada que hacer.");
  process.exit(0);
}

// Insertamos las que faltan justo antes de <application ...>
const block = missing.map((p) => "    " + p).join("\n") + "\n";
const appTagIndex = xml.indexOf("<application");

if (appTagIndex === -1) {
  console.error("No se encontro la etiqueta <application> en el manifest.");
  process.exit(1);
}

xml = xml.slice(0, appTagIndex) + block + xml.slice(appTagIndex);
fs.writeFileSync(manifestPath, xml, "utf8");

console.log("Permisos Bluetooth agregados:");
missing.forEach((p) => console.log("  " + p));
