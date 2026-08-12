import yaml from 'yaml'
import { readFileSync, writeFileSync } from 'fs'
import { sitesConfig } from './sites'

const pkg = readFileSync('package.json', 'utf-8')
let changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const tag = process.env.RELEASE_TAG || version
const downloadUrl = `https://github.com/lufeiit/sparkle-LF/releases/download/${tag}`
const latest = {
  version,
  tag,
  changelog
}

if (process.env.SKIP_CHANGELOG !== '1') {
  changelog += '\n### 下载地址：\n\n'
  for (const site of sitesConfig) {
    const p = `sparkle-${site.id}-`
    changelog += `#### ${site.name.zh}（${site.name.en}）：\n\n`
    changelog += `- Windows 10/11：[64 位安装版](${downloadUrl}/${p}windows-${version}-x64-setup.exe) | [ARM64 安装版](${downloadUrl}/${p}windows-${version}-arm64-setup.exe) | [64 位便携版](${downloadUrl}/${p}windows-${version}-x64-portable.7z)\n\n`
    changelog += `- macOS 11+：[Intel DMG](${downloadUrl}/${p}macos-${version}-x64.dmg) | [Apple Silicon DMG](${downloadUrl}/${p}macos-${version}-arm64.dmg)\n\n`
    changelog += `- Linux：[DEB 64 位](${downloadUrl}/${p}linux-${version}-amd64.deb) | [ARM64](${downloadUrl}/${p}linux-${version}-arm64.deb) | [loong64](${downloadUrl}/${p}linux-${version}-loong64.deb)\n\n`
    changelog += `- RPM：[64 位](${downloadUrl}/${p}linux-${version}-x86_64.rpm) | [ARM64](${downloadUrl}/${p}linux-${version}-aarch64.rpm) | [loong64](${downloadUrl}/${p}linux-${version}-loongarch64.rpm)\n\n`
    changelog += `- PACMAN：[64 位](${downloadUrl}/${p}linux-${version}-x64.pkg.tar.zst) | [ARM64](${downloadUrl}/${p}linux-${version}-aarch64.pkg.tar.zst) | [loong64](${downloadUrl}/${p}linux-${version}-loong64.pkg.tar.zst)\n\n`
  }
  changelog += '> macOS 首次打开如提示“无法验证开发者”，请右键点击 App 选择“打开”，或在终端运行：`sudo xattr -r -d com.apple.quarantine /Applications/Sparkle.app`\n'
}
writeFileSync('latest.yml', yaml.stringify(latest))
writeFileSync('changelog.md', changelog)
