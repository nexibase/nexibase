#!/usr/bin/env node
/**
 * custom/app이 있으면 custom을 사용하고, 없으면 src/app을 사용하도록
 * 루트의 app 심볼릭 링크를 설정합니다.
 *
 * 사용자는 src/app을 custom/app으로 복사하여 커스터마이징할 수 있습니다.
 * git pull 시 src/app은 업데이트되지만, custom/app은 영향받지 않습니다.
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const appLink = path.join(rootDir, 'app');
const customApp = path.join(rootDir, 'custom/app');
const srcApp = path.join(rootDir, 'src/app');

// 기존 app 링크/폴더 확인
if (fs.existsSync(appLink)) {
  const stats = fs.lstatSync(appLink);
  if (stats.isSymbolicLink()) {
    fs.unlinkSync(appLink);
    console.log('기존 app 심볼릭 링크 제거');
  } else {
    console.log('경고: app 폴더가 이미 존재합니다 (심볼릭 링크가 아님)');
    process.exit(0);
  }
}

// custom/app이 있으면 custom/app 사용, 없으면 src/app 사용
if (fs.existsSync(customApp)) {
  fs.symlinkSync('custom/app', appLink, 'dir');
  console.log('✓ custom/app을 사용합니다 (커스텀 모드)');
} else {
  fs.symlinkSync('src/app', appLink, 'dir');
  console.log('✓ src/app을 사용합니다 (기본 모드)');
}
