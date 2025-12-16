#!/usr/bin/env node

/**
 * custom.css 설정 스크립트
 *
 * custom.css 파일이 없으면 custom.example.css를 복사하여 생성합니다.
 * postinstall 시점에 실행됩니다.
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'src', 'app');
const customCss = path.join(appDir, 'custom.css');
const exampleCss = path.join(appDir, 'custom.example.css');

if (!fs.existsSync(customCss)) {
  if (fs.existsSync(exampleCss)) {
    fs.copyFileSync(exampleCss, customCss);
    console.log('✅ custom.css 파일이 생성되었습니다.');
    console.log('   프로젝트별 스타일 커스터마이징은 src/app/custom.css를 수정하세요.');
  } else {
    // example 파일도 없으면 빈 파일 생성
    fs.writeFileSync(customCss, '/* 커스텀 스타일을 여기에 추가하세요 */\n');
    console.log('✅ 빈 custom.css 파일이 생성되었습니다.');
  }
} else {
  console.log('ℹ️  custom.css 파일이 이미 존재합니다.');
}
