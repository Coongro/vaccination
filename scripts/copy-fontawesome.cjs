const fs = require('fs/promises');
const path = require('path');

async function resolvePackageDir(packageName) {
  const entry = require.resolve(packageName, {
    paths: [
      __dirname,
      path.join(__dirname, '..'),
      path.join(__dirname, '..', '..'),
      path.join(__dirname, '..', '..', '..'),
    ],
  });
  return path.dirname(entry);
}

async function copy() {
  const root = path.join(__dirname, '..');
  const packageDir = await resolvePackageDir('@fortawesome/fontawesome-free/package.json');
  const srcCss = path.join(packageDir, 'css', 'all.min.css');
  const srcFonts = path.join(packageDir, 'webfonts');

  const destCssDir = path.join(root, 'dist', 'assets', 'fontawesome', 'css');
  const destFontsDir = path.join(root, 'dist', 'assets', 'fontawesome', 'webfonts');

  await fs.mkdir(destCssDir, { recursive: true });
  await fs.mkdir(destFontsDir, { recursive: true });

  await fs.copyFile(srcCss, path.join(destCssDir, 'all.min.css'));
  await fs.cp(srcFonts, destFontsDir, { recursive: true });
}

copy().catch((error) => {
  console.error('Failed to copy FontAwesome assets', error);
  process.exit(1);
});
