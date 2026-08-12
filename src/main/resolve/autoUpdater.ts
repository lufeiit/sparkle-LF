import axios, { AxiosRequestConfig, CancelTokenSource } from 'axios'
import { parseYaml } from '../utils/yaml'
import { app, shell } from 'electron'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { dataDir, exeDir, exePath, isPortable, resourcesFilesDir } from '../utils/dirs'
import { copyFile, mkdir, readdir, rm, writeFile, readFile, statfs } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import os from 'os'
import { setNotQuitDialog, mainWindow } from '..'
import { triggerSysProxy } from '../sys/sysproxy'
import { serviceStatus, stopService } from '../service/manager'
import {
  clearAppUpdateServiceFallbackPause,
  pauseServiceFallbackForAppUpdate
} from '../service/fallback'
import { appendAppLog } from '../utils/log'

let downloadCancelToken: CancelTokenSource | null = null
const WINDOWS_INSTALLER_MIN_TEMP_SPACE_BYTES = 1024 * 1024 * 1024
const UPDATE_MANIFEST_URLS: Record<AppUpdateChannel, string> = {
  stable: 'https://github.com/lufeiit/sparkle-LF/releases/latest/download/latest.yml',
  rolling: 'https://github.com/lufeiit/sparkle-LF/releases/download/rolling/latest.yml'
}

function getGitHubAuthHeaders(token?: string): Record<string, string> {
  const normalizedToken = token?.trim()
  return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {}
}

function resolveReleaseTag(version: string, tag?: string): string {
  if (tag) return tag
  if (version.includes('-rolling-')) return 'rolling'
  return version
}

async function ensureFreeSpace(dir: string, requiredBytes: number, message: string): Promise<void> {
  const stats = await statfs(dir)
  const freeBytes = Number(BigInt(stats.bavail) * BigInt(stats.bsize))
  if (freeBytes < requiredBytes) {
    const freeMb = Math.floor(freeBytes / 1024 / 1024)
    const requiredMb = Math.ceil(requiredBytes / 1024 / 1024)
    throw new Error(`${message}。需要：${requiredMb} MB，当前可用：${freeMb} MB`)
  }
}

export async function checkUpdate(): Promise<AppVersion | undefined> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const { updateChannel = 'stable', githubToken } = await getAppConfig()
  const url = UPDATE_MANIFEST_URLS[updateChannel]
  const res = await axios.get(url, {
    headers: {
      'Content-Type': 'application/octet-stream',
      ...getGitHubAuthHeaders(githubToken)
    },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }),
    responseType: 'text'
  })
  const latest = parseYaml<AppVersion>(res.data)
  const currentVersion = app.getVersion()
  if (latest.version !== currentVersion) {
    return latest
  } else {
    return undefined
  }
}

async function stopServiceForPortableUpdate(): Promise<void> {
  const status = await serviceStatus().catch(async (error) => {
    await appendAppLog(`[Updater]: query service status failed before portable update, ${error}\n`)
    return 'unknown' as const
  })

  if (status === 'not-installed' || status === 'stopped') {
    return
  }

  await appendAppLog(`[Updater]: stop service before portable update, status: ${status}\n`)
  await stopService()
}

async function ensureWindowsInstallerTempSpace(): Promise<void> {
  if (process.platform !== 'win32') {
    return
  }

  const tempDir = os.tmpdir()
  await ensureFreeSpace(tempDir, WINDOWS_INSTALLER_MIN_TEMP_SPACE_BYTES, '临时目录空间不足')
}

export async function downloadAndInstallUpdate(version: string, tag?: string): Promise<void> {
  let appUpdateInstalling = false
  let sysProxyPaused = false
  const pauseSysProxy = async (): Promise<void> => {
    sysProxyPaused = true
    await triggerSysProxy(false, false)
  }
  const resumeSysProxy = async (): Promise<void> => {
    if (!sysProxyPaused) return
    sysProxyPaused = false
    try {
      const { sysProxy, onlyActiveDevice = false } = await getAppConfig()
      if (sysProxy.enable) await triggerSysProxy(true, onlyActiveDevice)
    } catch (error) {
      await appendAppLog(`[Updater]: restore sysproxy failed, ${error}\n`).catch(() => {})
    }
  }
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const { githubToken } = await getAppConfig()
  const releaseTag = resolveReleaseTag(version, tag)
  const baseUrl = `https://github.com/lufeiit/sparkle-LF/releases/download/${releaseTag}/`
  // 分网站专属包：产物文件名带网站前缀（如 sparkle-lufei-...）；未分网站时为 sparkle-...
  const sitePrefix = __SITE_ID__ ? `sparkle-${__SITE_ID__}-` : 'sparkle-'
  const fileMap: Record<string, string> = {
    'win32-x64': `${sitePrefix}windows-${version}-x64-setup.exe`,
    'win32-arm64': `${sitePrefix}windows-${version}-arm64-setup.exe`,
    'darwin-x64': `${sitePrefix}macos-${version}-x64.dmg`,
    'darwin-arm64': `${sitePrefix}macos-${version}-arm64.dmg`
  }
  let file = fileMap[`${process.platform}-${process.arch}`]
  if (isPortable()) {
    file = file.replace('-setup.exe', '-portable.7z')
  }
  if (!file) {
    throw new Error('不支持自动更新，请手动下载更新')
  }
  downloadCancelToken = axios.CancelToken.source()

  const apiUrl = `https://api.github.com/repos/lufeiit/sparkle-LF/releases/tags/${releaseTag}`
  const apiRequestConfig: AxiosRequestConfig = {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      ...getGitHubAuthHeaders(githubToken)
    },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }),
    cancelToken: downloadCancelToken.token
  }

  try {
    mainWindow?.webContents.send('update-status', {
      downloading: true,
      progress: 0
    })

    const releaseRes = await axios.get(apiUrl, apiRequestConfig)
    const assets: Array<{ name: string; digest?: string; size?: number }> =
      releaseRes.data.assets || []
    const matchedAsset = assets.find((a) => a.name === file)
    if (!matchedAsset || !matchedAsset.digest) {
      throw new Error(`无法从 GitHub Release 中找到 "${file}" 对应的 SHA-256 信息`)
    }
    const expectedHash = matchedAsset.digest.split(':')[1].toLowerCase()

    if (!existsSync(path.join(dataDir(), file))) {
      if (matchedAsset.size) {
        await ensureFreeSpace(dataDir(), matchedAsset.size, '更新包保存目录空间不足')
      }
      const res = await axios.get(`${baseUrl}${file}`, {
        responseType: 'arraybuffer',
        ...(mixedPort != 0 && {
          proxy: {
            protocol: 'http',
            host: '127.0.0.1',
            port: mixedPort
          }
        }),
        headers: {
          'Content-Type': 'application/octet-stream',
          ...getGitHubAuthHeaders(githubToken)
        },
        cancelToken: downloadCancelToken.token,
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          )
          mainWindow?.webContents.send('update-status', {
            downloading: true,
            progress: percentCompleted
          })
        }
      })
      await writeFile(path.join(dataDir(), file), res.data)
    }

    const fileBuffer = await readFile(path.join(dataDir(), file))
    const hashSum = createHash('sha256')
    hashSum.update(fileBuffer)
    const localHash = hashSum.digest('hex').toLowerCase()
    if (localHash !== expectedHash) {
      await rm(path.join(dataDir(), file), { force: true })
      throw new Error(`SHA-256 校验失败：本地哈希 ${localHash} 与预期 ${expectedHash} 不符`)
    }

    mainWindow?.webContents.send('update-status', {
      downloading: false,
      progress: 100
    })

    if (file.endsWith('.exe')) {
      await ensureWindowsInstallerTempSpace()
      await pauseSysProxy()
      await pauseServiceFallbackForAppUpdate()
      spawn(path.join(dataDir(), file), ['/S', '--updated', '--force-run'], {
        detached: true,
        stdio: 'ignore'
      }).unref()
      appUpdateInstalling = true
    }
    if (file.endsWith('.7z')) {
      await pauseSysProxy()
      await pauseServiceFallbackForAppUpdate()
      await stopServiceForPortableUpdate()
      await copyFile(path.join(resourcesFilesDir(), '7za.exe'), path.join(dataDir(), '7za.exe'))
      spawn(
        'cmd',
        [
          '/C',
          `"timeout /t 2 /nobreak >nul && "${path.join(dataDir(), '7za.exe')}" x -o"${exeDir()}" -y "${path.join(dataDir(), file)}" & start "" "${exePath()}""`
        ],
        {
          shell: true,
          detached: true
        }
      ).unref()
      appUpdateInstalling = true
      setNotQuitDialog()
      app.quit()
    }
    if (file.endsWith('.dmg')) {
      try {
        await pauseSysProxy()
        await pauseServiceFallbackForAppUpdate()
        const execPromise = promisify(exec)
        const dmgPath = path.join(dataDir(), file)
        const mountPoint = path.join(dataDir(), 'sparkle-dmg-mount')
        await rm(mountPoint, { recursive: true, force: true })
        await mkdir(mountPoint, { recursive: true })
        await execPromise(`hdiutil attach "${dmgPath}" -nobrowse -mountpoint "${mountPoint}"`)
        try {
          const entries = await readdir(mountPoint)
          const appEntry = entries.find((entry) => entry.endsWith('.app'))
          if (!appEntry) {
            throw new Error('更新包中未找到 .app 应用')
          }
          // 当前运行中的 App bundle 路径（/path/to/Sparkle.app）
          const currentAppPath = path.dirname(path.dirname(app.getPath('exe')))
          const installCmd = `rm -rf "${currentAppPath}" && ditto "${path.join(mountPoint, appEntry)}" "${currentAppPath}"`
          const command = `do shell script "${installCmd}" with administrator privileges`
          await execPromise(`osascript -e '${command}'`)
        } finally {
          await execPromise(`hdiutil detach "${mountPoint}" -force`).catch(() => {})
        }
        appUpdateInstalling = true
        app.relaunch()
        setNotQuitDialog()
        app.quit()
      } catch {
        await clearAppUpdateServiceFallbackPause()
        await resumeSysProxy()
        shell.openPath(path.join(dataDir(), file))
      }
    }
  } catch (e) {
    if (!appUpdateInstalling) {
      await clearAppUpdateServiceFallbackPause()
      await resumeSysProxy()
    }
    await rm(path.join(dataDir(), file), { force: true })
    if (axios.isCancel(e)) {
      mainWindow?.webContents.send('update-status', {
        downloading: false,
        progress: 0,
        error: '下载已取消'
      })
      return
    } else {
      mainWindow?.webContents.send('update-status', {
        downloading: false,
        progress: 0,
        error: e instanceof Error ? e.message : '下载失败'
      })
    }
    throw e
  } finally {
    downloadCancelToken = null
  }
}

export async function cancelUpdate(): Promise<void> {
  if (downloadCancelToken) {
    downloadCancelToken.cancel('用户取消下载')
    downloadCancelToken = null
  }
}
