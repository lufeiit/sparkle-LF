import fs from 'fs'
import AdmZip from 'adm-zip'
import path from 'path'
import zlib from 'zlib'
import { extract } from 'tar'
import { execSync } from 'child_process'

const cwd = process.cwd()
const TEMP_DIR = path.join(cwd, 'node_modules/.temp')
let arch: string = process.arch
const platform = process.platform

// 版本缓存（extra/kernels/versions.json）：仓库内置内核的版本，CI 优先使用避免 fetch GitHub
const SIDECAR_VERSION_FILE = path.join(cwd, 'extra', 'kernels', 'versions.json')
function readCachedVersion(key: string): string | undefined {
  try {
    if (fs.existsSync(SIDECAR_VERSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SIDECAR_VERSION_FILE, 'utf-8'))
      return data[key]
    }
  } catch {
    // ignore
  }
  return undefined
}
function writeCachedVersion(key: string, value: string): void {
  try {
    fs.mkdirSync(path.dirname(SIDECAR_VERSION_FILE), { recursive: true })
    let data: Record<string, string> = {}
    if (fs.existsSync(SIDECAR_VERSION_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(SIDECAR_VERSION_FILE, 'utf-8'))
      } catch {
        data = {}
      }
    }
    data[key] = value
    fs.writeFileSync(SIDECAR_VERSION_FILE, JSON.stringify(data, null, 2))
  } catch {
    // ignore
  }
}
if (process.argv.slice(2).length !== 0) {
  arch = process.argv.slice(2)[0].replace('--', '')
}

if (process.env.SKIP_PREPARE === '1') {
  console.log('Skipping prepare script...')
  process.exit(0)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/* ======= mihomo alpha======= */
const MIHOMO_ALPHA_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const MIHOMO_ALPHA_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha`
let MIHOMO_ALPHA_VERSION: string

const MIHOMO_ALPHA_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

// Fetch the latest alpha release version from the version.txt file
async function getLatestAlphaVersion() {
  // 优先使用缓存的版本（配合仓库内置内核 extra/kernels），避免每次从 GitHub 获取
  const cached = readCachedVersion('_alpha_version')
  if (cached) {
    MIHOMO_ALPHA_VERSION = cached
    console.log(`使用缓存 alpha 版本: ${MIHOMO_ALPHA_VERSION}`)
    return
  }
  try {
    const response = await fetch(MIHOMO_ALPHA_VERSION_URL, {
      method: 'GET'
    })
    const v = await response.text()
    MIHOMO_ALPHA_VERSION = v.trim() // Trim to remove extra whitespaces
    console.log(`Latest alpha version: ${MIHOMO_ALPHA_VERSION}`)
    writeCachedVersion('_alpha_version', MIHOMO_ALPHA_VERSION)
  } catch (error) {
    console.error('Error fetching latest alpha version:', getErrorMessage(error))
    throw error // 抛错让任务重试（process.exit 会绕过重试直接退出）
  }
}

/* ======= mihomo release ======= */
const MIHOMO_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'
const MIHOMO_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download`
let MIHOMO_VERSION: string

const MIHOMO_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

// Fetch the latest release version from the version.txt file
async function getLatestReleaseVersion() {
  // 优先使用缓存的版本（配合仓库内置内核 extra/kernels），避免每次从 GitHub 获取
  const cached = readCachedVersion('_release_version')
  if (cached) {
    MIHOMO_VERSION = cached
    console.log(`使用缓存 release 版本: ${MIHOMO_VERSION}`)
    return
  }
  try {
    const response = await fetch(MIHOMO_VERSION_URL, {
      method: 'GET'
    })
    const v = await response.text()
    MIHOMO_VERSION = v.trim() // Trim to remove extra whitespaces
    console.log(`Latest release version: ${MIHOMO_VERSION}`)
    writeCachedVersion('_release_version', MIHOMO_VERSION)
  } catch (error) {
    console.error('Error fetching latest release version:', getErrorMessage(error))
    throw error // 抛错让任务重试（process.exit 会绕过重试直接退出）
  }
}

/*
 * check available
 */
if (!MIHOMO_MAP[`${platform}-${arch}`]) {
  throw new Error(`unsupported platform "${platform}-${arch}"`)
}

if (!MIHOMO_ALPHA_MAP[`${platform}-${arch}`]) {
  throw new Error(`unsupported platform "${platform}-${arch}"`)
}

/**
 * core info
 */
function MihomoAlpha() {
  const name = MIHOMO_ALPHA_MAP[`${platform}-${arch}`]
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_ALPHA_URL_PREFIX}/${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`

  return {
    name: 'mihomo-alpha',
    targetFile: `mihomo-alpha${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}

function mihomo() {
  const name = MIHOMO_MAP[`${platform}-${arch}`]
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_URL_PREFIX}/${MIHOMO_VERSION}/${name}-${MIHOMO_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_VERSION}.${urlExt}`

  return {
    name: 'mihomo',
    targetFile: `mihomo${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}
interface SidecarInfo {
  name: string
  targetFile: string
  zipFile: string
  exeFile: string
  downloadURL: string
}

interface ResourceInfo {
  file: string
  downloadURL: string
  needExecutable?: boolean
}

/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo: SidecarInfo) {
  const { name, targetFile, zipFile, exeFile, downloadURL } = binInfo

  const sidecarDir = path.join(cwd, 'extra', 'sidecar')
  const sidecarPath = path.join(sidecarDir, targetFile)

  fs.mkdirSync(sidecarDir, { recursive: true })

  // 版本标记（downloadURL 即版本标识）：已存在且版本一致则跳过，避免重复下载/触发限流
  const versionFile = path.join(sidecarDir, 'versions.json')
  let versions: Record<string, string> = {}
  if (fs.existsSync(versionFile)) {
    try {
      versions = JSON.parse(fs.readFileSync(versionFile, 'utf-8'))
    } catch {
      versions = {}
    }
  }
  if (fs.existsSync(sidecarPath) && versions[name] === downloadURL) {
    console.log(`[INFO]: "${name}" 已存在且版本一致，跳过下载`)
    return
  }
  if (fs.existsSync(sidecarPath)) {
    fs.rmSync(sidecarPath)
  }
  const tempDir = path.join(TEMP_DIR, name)
  const tempZip = path.join(tempDir, zipFile)
  const tempExe = path.join(tempDir, exeFile)

  fs.mkdirSync(tempDir, { recursive: true })
  try {
    // 优先使用仓库内置内核（extra/kernels/<platform>-<arch>/），避免 CI 从 GitHub 下载（503 限流）
    const kernelsDir = path.join(cwd, 'extra', 'kernels', `${platform}-${arch}`)
    const localZip = path.join(kernelsDir, zipFile)
    if (fs.existsSync(localZip)) {
      fs.copyFileSync(localZip, tempZip)
      console.log(`[INFO]: "${name}" 使用仓库内置内核 ${zipFile}`)
    } else if (!fs.existsSync(tempZip)) {
      await downloadFile(downloadURL, tempZip)
    }

    if (zipFile.endsWith('.zip')) {
      const zip = new AdmZip(tempZip)
      zip.getEntries().forEach((entry) => {
        console.log(`[DEBUG]: "${name}" entry name`, entry.entryName)
      })
      zip.extractAllTo(tempDir, true)
      fs.renameSync(tempExe, sidecarPath)
      console.log(`[INFO]: "${name}" unzip finished`)
    } else if (zipFile.endsWith('.tgz')) {
      // tgz
      fs.mkdirSync(tempDir, { recursive: true })
      await extract({
        cwd: tempDir,
        file: tempZip
      })
      const files = fs.readdirSync(tempDir)
      console.log(`[DEBUG]: "${name}" files in tempDir:`, files)
      const extractedFile = files.find((file) => file.startsWith('虚空终端-'))
      if (extractedFile) {
        const extractedFilePath = path.join(tempDir, extractedFile)
        fs.renameSync(extractedFilePath, sidecarPath)
        console.log(`[INFO]: "${name}" file renamed to "${sidecarPath}"`)
        execSync(`chmod 755 ${sidecarPath}`)
        console.log(`[INFO]: "${name}" chmod binary finished`)
      } else {
        throw new Error(`Expected file not found in ${tempDir}`)
      }
    } else {
      // gz
      const readStream = fs.createReadStream(tempZip)
      const writeStream = fs.createWriteStream(sidecarPath)
      await new Promise<void>((resolve, reject) => {
        const onError = (error: unknown) => {
          console.error(`[ERROR]: "${name}" gz failed:`, getErrorMessage(error))
          reject(error)
        }
        readStream
          .pipe(zlib.createGunzip().on('error', onError))
          .pipe(writeStream)
          .on('finish', () => {
            console.log(`[INFO]: "${name}" gunzip finished`)
            execSync(`chmod 755 ${sidecarPath}`)
            console.log(`[INFO]: "${name}" chmod binary finished`)
            resolve()
          })
          .on('error', onError)
      })
    }
    // 记录版本标记
    versions[name] = downloadURL
    fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2))
  } catch (err) {
    // 需要删除文件
    fs.rmSync(sidecarPath)
    throw err
  } finally {
    fs.rmSync(tempDir, { recursive: true })
  }
}

/**
 * download the file to the extra dir
 */
async function resolveResource(binInfo: ResourceInfo) {
  const { file, downloadURL, needExecutable = false } = binInfo

  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, file)

  // 版本标记（downloadURL 即版本标识）：已存在且版本一致则跳过，避免重复下载/触发限流
  const versionFile = path.join(resDir, 'versions.json')
  let versions: Record<string, string> = {}
  if (fs.existsSync(versionFile)) {
    try {
      versions = JSON.parse(fs.readFileSync(versionFile, 'utf-8'))
    } catch {
      versions = {}
    }
  }
  if (fs.existsSync(targetPath) && versions[file] === downloadURL) {
    console.log(`[INFO]: ${file} 已存在且版本一致，跳过下载`)
    return
  }

  // 优先从仓库内置内核复制（平台特定文件：7za/runner/enableLoopback 等），避免 CI 从 GitHub 下载（限流）
  const kernelsFile = path.join(cwd, 'extra', 'kernels', `${platform}-${arch}`, file)
  if (fs.existsSync(kernelsFile)) {
    fs.mkdirSync(resDir, { recursive: true })
    fs.copyFileSync(kernelsFile, targetPath)
    if (needExecutable && platform !== 'win32') {
      execSync(`chmod 755 ${targetPath}`)
    }
    versions[file] = downloadURL
    fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2))
    console.log(`[INFO]: ${file} 使用仓库内置内核文件`)
    return
  }

  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath)
  }

  fs.mkdirSync(resDir, { recursive: true })
  await downloadFile(downloadURL, targetPath)

  if (needExecutable && platform !== 'win32') {
    execSync(`chmod 755 ${targetPath}`)
    console.log(`[INFO]: ${file} chmod finished`)
  }

  // 记录版本标记
  versions[file] = downloadURL
  fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2))
  console.log(`[INFO]: ${file} finished`)
}

/**
 * download file and save to `path`
 */
async function downloadFile(url: string | URL | Request, path: fs.PathOrFileDescriptor) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/octet-stream' }
  })
  const buffer = await response.arrayBuffer()
  fs.writeFileSync(path, new Uint8Array(buffer))

  console.log(`[INFO]: download finished "${url}"`)
}

const resolveMmdb = () =>
  resolveResource({
    file: 'country.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb`
  })
const resolveMetadb = () =>
  resolveResource({
    file: 'geoip.metadb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb`
  })
const resolveGeosite = () =>
  resolveResource({
    file: 'geosite.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat`
  })
const resolveGeoIP = () =>
  resolveResource({
    file: 'geoip.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat`
  })
const resolveASN = () =>
  resolveResource({
    file: 'ASN.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb`
  })
const resolveBundleMRS = () =>
  resolveResource({
    file: 'BundleMRS.7z',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/BundleMRS.7z`
  })
const resolveEnableLoopback = () =>
  resolveResource({
    file: 'enableLoopback.exe',
    downloadURL: `https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe`
  })
const resolveSparkleService = async () => {
  const map = {
    'win32-x64': 'sparkle-service-windows-amd64-v3',
    'win32-ia32': 'sparkle-service-windows-386',
    'win32-arm64': 'sparkle-service-windows-arm64',
    'darwin-x64': 'sparkle-service-darwin-amd64-v3',
    'darwin-arm64': 'sparkle-service-darwin-arm64',
    'linux-x64': 'sparkle-service-linux-amd64-v3',
    'linux-arm64': 'sparkle-service-linux-arm64',
    'linux-loong64': 'sparkle-service-linux-loong64-abi2'
  }
  if (!map[`${platform}-${arch}`]) {
    throw new Error(`unsupported platform "${platform}-${arch}"`)
  }
  const base = map[`${platform}-${arch}`]
  const ext = platform == 'win32' ? '.exe' : ''
  const file = `sparkle-service${ext}`
  const downloadURL = `https://github.com/UruhaLushia/sparkle-service/releases/download/pre-release/${base}${ext}`

  // 优先使用仓库内置（extra/kernels/<platform>-<arch>/），避免 CI 从 GitHub 下载（限流）
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, file)
  const kernelsFile = path.join(cwd, 'extra', 'kernels', `${platform}-${arch}`, file)
  if (fs.existsSync(kernelsFile)) {
    fs.mkdirSync(resDir, { recursive: true })
    fs.copyFileSync(kernelsFile, targetPath)
    if (platform !== 'win32') execSync(`chmod 755 ${targetPath}`)
    console.log(`[INFO]: ${file} 使用仓库内置 ${file}`)
    // 记录版本标记（downloadURL 即版本标识）
    const versionFile = path.join(resDir, 'versions.json')
    let versions: Record<string, string> = {}
    if (fs.existsSync(versionFile)) {
      try { versions = JSON.parse(fs.readFileSync(versionFile, 'utf-8')) } catch { versions = {} }
    }
    versions[file] = downloadURL
    fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2))
    return
  }

  return resolveResource({
    file,
    downloadURL,
    needExecutable: true
  })
}
const resolveRunner = () =>
  resolveResource({
    file: 'sparkle-run.exe',
    downloadURL: `https://github.com/xishang0128/sparkle-run/releases/download/${arch}/sparkle-run.exe`
  })

const resolveMonitor = async () => {
  const tempDir = path.join(TEMP_DIR, 'TrafficMonitor')
  const tempZip = path.join(tempDir, `${arch}.zip`)
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  // 优先使用仓库内置 monitor.zip（避免 CI 从 GitHub 下载限流）
  const kernelsZip = path.join(cwd, 'extra', 'kernels', `${platform}-${arch}`, 'monitor.zip')
  if (fs.existsSync(kernelsZip)) {
    fs.copyFileSync(kernelsZip, tempZip)
    console.log(`[INFO]: TrafficMonitor 使用仓库内置 monitor.zip`)
  } else {
    await downloadFile(
      `https://github.com/xishang0128/sparkle-run/releases/download/monitor/${arch}.zip`,
      tempZip
    )
  }
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'TrafficMonitor')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(targetPath, true)

  console.log(`[INFO]: TrafficMonitor finished`)
}

const resolve7zip = () =>
  resolveResource({
    file: '7za.exe',
    downloadURL: `https://github.com/develar/7zip-bin/raw/master/win/${arch}/7za.exe`
  })
const resolveSubstore = () =>
  resolveResource({
    file: 'sub-store.bundle.js',
    downloadURL:
      'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
  })
const resolveSubstoreFrontend = async () => {
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'sub-store-frontend')
  // 版本标记：已提交到仓库的文件（配合 extra/files/versions.json）直接跳过
  const versionFile = path.join(resDir, 'versions.json')
  let versions: Record<string, string> = {}
  if (fs.existsSync(versionFile)) {
    try {
      versions = JSON.parse(fs.readFileSync(versionFile, 'utf-8'))
    } catch {
      versions = {}
    }
  }
  const frontendURL =
    'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
  if (fs.existsSync(targetPath) && versions['sub-store-frontend'] === frontendURL) {
    console.log('[INFO]: sub-store-frontend 已存在且版本一致，跳过下载')
    return
  }
  const tempDir = path.join(TEMP_DIR, 'substore-frontend')
  const tempZip = path.join(tempDir, 'dist.zip')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(
    'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip',
    tempZip
  )
  const zip = new AdmZip(tempZip)
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(resDir, true)
  fs.renameSync(path.join(resDir, 'dist'), targetPath)

  if (platform !== 'win32') {
    try {
      const fixPermissions = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            fs.chmodSync(fullPath, 0o755)
            fixPermissions(fullPath)
          } else {
            fs.chmodSync(fullPath, 0o644)
          }
        }
      }
      fs.chmodSync(targetPath, 0o755)
      fixPermissions(targetPath)
      console.log(`[INFO]: sub-store-frontend permissions fixed`)
    } catch (error) {
      console.warn(`[WARN]: Failed to fix permissions: ${getErrorMessage(error)}`)
    }
  }

  console.log(`[INFO]: sub-store-frontend finished`)
}
const resolveFont = async () => {
  // const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'NotoColorEmoji.ttf')
  const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'twemoji.ttf')

  if (fs.existsSync(targetPath)) {
    return
  }
  await downloadFile(
    // 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
    'https://github.com/Sav22999/emoji/raw/refs/heads/master/font/twemoji.ttf',
    targetPath
  )

  console.log(`[INFO]: twemoji.ttf finished`)
}

type Task = {
  name: string
  func: () => Promise<void>
  retry: number
  winOnly?: boolean
  linuxOnly?: boolean
  unixOnly?: boolean
}

const tasks: Task[] = [
  {
    name: 'mihomo-alpha',
    func: () => getLatestAlphaVersion().then(() => resolveSidecar(MihomoAlpha())),
    retry: 5
  },
  {
    name: 'mihomo',
    func: () => getLatestReleaseVersion().then(() => resolveSidecar(mihomo())),
    retry: 5
  },
  { name: 'mmdb', func: resolveMmdb, retry: 5 },
  { name: 'metadb', func: resolveMetadb, retry: 5 },
  { name: 'geosite', func: resolveGeosite, retry: 5 },
  { name: 'geoip', func: resolveGeoIP, retry: 5 },
  { name: 'asn', func: resolveASN, retry: 5 },
  { name: 'bundlemrs', func: resolveBundleMRS, retry: 5 },
  {
    name: 'font',
    func: resolveFont,
    retry: 5
  },
  {
    name: 'enableLoopback',
    func: resolveEnableLoopback,
    retry: 5,
    winOnly: true
  },
  {
    name: 'sparkle-service',
    func: resolveSparkleService,
    retry: 5
  },
  {
    name: 'runner',
    func: resolveRunner,
    retry: 5,
    winOnly: true
  },
  {
    name: 'monitor',
    func: resolveMonitor,
    retry: 5,
    winOnly: true
  },
  {
    name: 'substore',
    func: resolveSubstore,
    retry: 5
  },
  {
    name: 'substorefrontend',
    func: resolveSubstoreFrontend,
    retry: 5
  },
  {
    name: '7zip',
    func: resolve7zip,
    retry: 5,
    winOnly: true
  }
]

async function runTask() {
  const task = tasks.shift()
  if (!task) return
  if (task.winOnly && platform !== 'win32') return runTask()
  if (task.linuxOnly && platform !== 'linux') return runTask()
  if (task.unixOnly && platform === 'win32') return runTask()

  for (let i = 0; i < task.retry; i++) {
    try {
      await task.func()
      break
    } catch (err) {
      console.error(`[ERROR]: task::${task.name} try ${i} ==`, getErrorMessage(err))
      if (i === task.retry - 1) throw err
    }
  }
  return runTask()
}

runTask()
runTask()
