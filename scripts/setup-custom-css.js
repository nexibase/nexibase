#!/usr/bin/env node

/**
 * custom 폴더 설정 스크립트
 *
 * custom 폴더가 없으면 custom.example 폴더를 복사하여 생성합니다.
 * postinstall 시점에 실행됩니다.
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'src', 'app');
const customDir = path.join(appDir, 'custom');
const exampleDir = path.join(appDir, 'custom.example');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(customDir)) {
  if (fs.existsSync(exampleDir)) {
    copyDir(exampleDir, customDir);
    console.log('✅ custom 폴더가 생성되었습니다.');
    console.log('   - src/app/custom/theme.css: 스타일 커스터마이징');
    console.log('   - src/app/custom/config.json: 사이트 설정 오버라이드');
  } else {
    // example 폴더도 없으면 기본 파일들 생성
    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(
      path.join(customDir, 'theme.css'),
      '/* 커스텀 스타일을 여기에 추가하세요 */\n'
    );
    fs.writeFileSync(
      path.join(customDir, 'config.json'),
      JSON.stringify({
        site: { name: null, logo: null, description: null },
        features: { shop: true, community: true, darkMode: true },
        header: { showSearch: true, showCart: true, showDarkModeToggle: true }
      }, null, 2)
    );
    fs.writeFileSync(
      path.join(customDir, 'index.ts'),
      `import configJson from './config.json'\nexport const customConfig = configJson\n`
    );
    console.log('✅ 기본 custom 폴더가 생성되었습니다.');
  }
} else {
  console.log('ℹ️  custom 폴더가 이미 존재합니다.');
}
