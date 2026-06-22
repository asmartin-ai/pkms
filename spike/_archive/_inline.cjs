// Inline CSS + JS + mobile overrides into each mockup's index.html.
// Run: node _inline.cjs
// Outputs to ./_send/<name>.html  (self-contained, mobile-tuned)
const fs = require("fs");
const path = require("path");

const root = "K:\\Projects\\PKMS\\spike";
const outDir = path.join(root, "_send");
fs.mkdirSync(outDir, { recursive: true });

const dirs = [
  "visual-home-glm",
  "visual-home-glm-2-workbench",
  "visual-home-glm-3-focus",
  "visual-home-glm-4-bloom",
];

const names = {
  "visual-home-glm":             "1-daily-edition",
  "visual-home-glm-2-workbench": "2-workbench",
  "visual-home-glm-3-focus":     "3-focus",
  "visual-home-glm-4-bloom":     "4-bloom",
};

const mobileCss = fs.readFileSync(path.join(root, "_mobile.css"), "utf8");

for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  let html = fs.readFileSync(path.join(dirPath, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(dirPath, "styles.css"), "utf8");
  const js  = fs.readFileSync(path.join(dirPath, "app.js"), "utf8");

  // Replace <link rel="stylesheet" href="styles.css"> with inline <style>
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="styles\.css"\s*>/g,
    `<style>\n${css}\n</style>`
  );

  // Replace <script src="app.js" defer></script> with inline <script>
  html = html.replace(
    /<script\s+src="app\.js"\s+defer\s*><\/script>/g,
    `<script>\n${js}\n</script>`
  );

  // Inject mobile-override CSS as a second <style>, right before </head>.
  // Placed AFTER the main stylesheet so its rules win the cascade.
  html = html.replace(
    /<\/head>/,
    `<style>\n/* === mobile overrides === */\n${mobileCss}\n</style>\n</head>`
  );

  const outFile = path.join(outDir, `${names[dir]}-mobile.html`);
  fs.writeFileSync(outFile, html, "utf8");

  const sizeKB = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`${names[dir]}-mobile.html  ${sizeKB} KB  (CSS + JS + mobile-override inlined)`);
}

console.log(`\nWrote ${dirs.length} mobile-tuned files to ${outDir}`);

