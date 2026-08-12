/**
 * ad-hoc 签名 hook（electron-builder mac afterSign）
 *
 * 无 Apple 开发者证书时，electron-builder 的 `identity: '-'` 会被当作证书名
 * 查找（security find-identity），找不到则跳过签名，导致 arm64 上
 * "Electron Framework ... different Team IDs" 崩溃。
 * 这里对所有组件统一做 ad-hoc 签名（codesign --force --deep --sign -），
 * 使主程序 / Electron Framework / Helper 的签名 Team ID 一致。
 */
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function afterSign(context) {
  const { appOutDir, packager } = context
  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log(`[afterSign] ad-hoc 签名: ${appPath}`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
  console.log('[afterSign] ad-hoc 签名完成')
}
