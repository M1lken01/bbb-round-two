'use strict';
const path = require('path');
const fsExtra = require('fs-extra');

async function copyFile(srcFile, destFile) {
  try {
    await fsExtra.copy(srcFile, destFile);
    console.log(`Successfully copied ${srcFile} to ${destFile}`);
  } catch (error) {
    console.error(`Error copying ${srcFile} to ${destFile}: ${error}`);
  }
}

async function copyDir(srcPath, destPath) {
  try {
    await fsExtra.ensureDir(destPath);
    const items = await fsExtra.readdir(srcPath);
    for (const item of items) {
      const srcItem = path.join(srcPath, item);
      const destItem = path.join(destPath, item);
      const stats = await fsExtra.stat(srcItem);

      if (stats.isDirectory()) await copyDir(srcItem, destItem);
      else if (!srcItem.endsWith('.ts')) await copyFile(srcItem, destItem);
    }
    console.log(`Successfully copied ${srcPath} to ${destPath}`);
  } catch (error) {
    console.error(`Error copying ${srcPath} to ${destPath}: ${error}`);
  }
}

async function main() {
  const distPath = 'dist';
  const srcPath = 'src';
  await fsExtra.ensureDir(distPath);

  await copyDir(path.join(srcPath, 'imgs'), path.join(distPath, 'imgs'));
  //await copyFile(path.join(srcPath, 'favicon.ico'), path.join(distPath, 'favicon.ico'));
}

main().catch((error) => console.error(error));
