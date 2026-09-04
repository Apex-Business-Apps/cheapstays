// tsc only emits compiled .ts files — non-TS assets that the compiled main
// process reads at runtime (the SQL migrations) have to be copied into
// dist/ manually as part of the build.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const srcMigrations = path.join(root, "src", "main", "db", "migrations");
const distMigrations = path.join(root, "dist", "main", "db", "migrations");

fs.mkdirSync(distMigrations, { recursive: true });
for (const file of fs.readdirSync(srcMigrations)) {
  fs.copyFileSync(path.join(srcMigrations, file), path.join(distMigrations, file));
}

console.log(`Copied ${fs.readdirSync(distMigrations).length} migration file(s) to dist/main/db/migrations`);
