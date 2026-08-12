interface AppVersion {
  version: string
  tag?: string
  changelog: string
}

// 分网站打包：构建时由 electron.vite.config.ts 注入（SITE 环境变量）
declare const __SITE_ID__: string

type AppUpdateChannel = 'stable' | 'rolling'
type AppNotificationMode = 'system' | 'toast'
type AppNotificationVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface AppNotificationPayload {
  title: string
  body?: string
  persistent?: boolean
  url?: string
  variant?: AppNotificationVariant
}

interface ISysProxyConfig {
  enable: boolean
  host?: string
  mode?: SysProxyMode
  bypass?: string[]
  pacScript?: string
  settingMode?: 'exec' | 'service'
  guard?: boolean
  guardNotify?: boolean
}

interface IHost {
  domain: string
  value: string | string[]
}

interface AppConfig {
  updateChannel: AppUpdateChannel
  notificationMode?: AppNotificationMode
  showUpdateButtonAfterNotification?: boolean
  core: 'mihomo' | 'mihomo-alpha' | 'system'
  systemCorePath?: string
  corePermissionMode?: 'elevated' | 'service'
  serviceAuthKey?: string
  disableLoopbackDetector: boolean
  disableEmbedCA: boolean
  disableSystemCA: boolean
  disableNftables: boolean
  safePaths: string[]
  proxyDisplayOrder: 'default' | 'delay' | 'name'
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
  groupDisplayLayout: 'hidden' | 'single' | 'double'
  showGroupSelectedProxy: boolean
  showProxyDetailTooltip: boolean
  profileDisplayDate?: 'expire' | 'update'
  envType?: ('bash' | 'fish' | 'cmd' | 'powershell' | 'nushell')[]
  proxyCols: 'auto' | '1' | '2' | '3' | '4'
  connectionDirection: 'asc' | 'desc'
  connectionOrderBy: 'time' | 'upload' | 'download' | 'uploadSpeed' | 'downloadSpeed' | 'process'
  connectionGroupByProcess?: boolean
  connectionGroupSort?: 'name' | 'count' | 'upload' | 'download' | 'uploadSpeed' | 'downloadSpeed'
  connectionGroupDirection?: 'asc' | 'desc'
  connectionInterval?: number
  spinFloatingIcon?: boolean
  disableTray?: boolean
  showFloatingWindow?: boolean
  connectionCardStatus?: CardStatus
  dnsCardStatus?: CardStatus
  logCardStatus?: CardStatus
  pauseSSID?: string[]
  mihomoCoreCardStatus?: CardStatus
  overrideCardStatus?: CardStatus
  profileCardStatus?: CardStatus
  proxyCardStatus?: CardStatus
  resourceCardStatus?: CardStatus
  ruleCardStatus?: CardStatus
  sniffCardStatus?: CardStatus
  substoreCardStatus?: CardStatus
  sysproxyCardStatus?: CardStatus
  tunCardStatus?: CardStatus
  githubToken?: string
  gistSyncEnabled?: boolean
  gistEncrypted?: boolean
  gistAgeRecipient?: string
  gistAgeIdentity?: string
  useSubStore: boolean
  subStoreHost?: string
  subStoreBackendSyncCron?: string
  subStoreBackendDownloadCron?: string
  subStoreBackendUploadCron?: string
  autoLightweight?: boolean
  autoLightweightDelay?: number
  autoLightweightMode?: 'core' | 'tray'
  coreStartupMode?: 'post-up' | 'log'
  useCustomSubStore?: boolean
  useProxyInSubStore?: boolean
  mihomoCpuPriority?: Priority
  customSubStoreUrl?: string
  diffWorkDir?: boolean
  autoSetDNSMode?: 'none' | 'exec' | 'service'
  originDNS?: string
  useWindowFrame: boolean
  proxyInTray: boolean
  trayProxyDelayLayout?: 'same-line' | 'new-line'
  siderOrder: string[]
  siderWidth: number
  appTheme: AppTheme
  customTheme?: string
  autoCheckUpdate: boolean
  silentStart: boolean
  autoCloseConnection: boolean
  closeMode: 'all' | 'group'
  sysProxy: ISysProxyConfig
  saveLogs?: boolean
  maxLogDays: number
  maxLogFileSizeMB?: number
  maxLogEntries?: number
  realtimeLogLevel?: LogLevel
  userAgent?: string
  delayTestConcurrency?: number
  delayTestUseGroupApi?: boolean
  delayTestUrl?: string
  delayTestUrlScope?: 'group' | 'global'
  delayTestTimeout?: number
  encryptedPassword?: number[]
  rememberProxyGroupOpenState?: boolean
  controlDns?: boolean
  controlSniff?: boolean
  useDockIcon?: boolean
  showTraffic?: boolean
  customTrayIcon?: string
  useCustomTrayMenu?: boolean
  webdavUrl?: string
  webdavDir?: string
  webdavUsername?: string
  webdavPassword?: string
  hosts: IHost[]
  showWindowShortcut?: string
  showFloatingWindowShortcut?: string
  triggerSysProxyShortcut?: string
  triggerTunShortcut?: string
  ruleModeShortcut?: string
  globalModeShortcut?: string
  directModeShortcut?: string
  restartAppShortcut?: string
  quitWithoutCoreShortcut?: string
  onlyActiveDevice?: boolean
  networkDetection?: boolean
  networkDetectionBypass?: string[]
  networkDetectionInterval?: number
  displayIcon?: boolean
  displayAppName?: boolean
  disableGPU: boolean
  disableAnimation?: boolean
}

interface ProfileConfig {
  current?: string
  items: ProfileItem[]
}

interface ProfileItem {
  id: string
  type: 'remote' | 'local' | 'v2board'
  name: string
  url?: string // remote
  fingerprint?: string // remote
  ua?: string // remote
  file?: string // local
  verify?: boolean // remote
  interval?: number
  home?: string
  updated?: number
  override?: string[]
  useProxy?: boolean
  ageRecipient?: string
  ageIdentity?: string
  extra?: SubscriptionUserInfo
  substore?: boolean
  locked?: boolean
  autoUpdate?: boolean
  v2board?: V2BoardAccount
}

interface V2BoardAccount {
  site?: string
  sites?: string[]
  email?: string
  password?: string
  name?: {
    zh?: string
    en?: string
  }
}

interface SubscriptionUserInfo {
  upload: number
  download: number
  total: number
  expire: number
}

interface OverrideConfig {
  items: OverrideItem[]
}

interface OverrideItem {
  id: string
  type: 'remote' | 'local'
  ext: 'js' | 'yaml'
  name: string
  updated: number
  global?: boolean
  url?: string
  file?: string
  fingerprint?: string
}

interface SubStoreSub {
  name: string
  displayName?: string
  icon?: string
  tag?: string[]
}

interface SiteGroup {
  name: string
  url: string
}

interface SiteConfig {
  id: string
  name: { zh: string; en: string }
  apiSites: string[]
  website?: string
  accessUrls?: string[]
  chatwoot?: {
    host: string
    websiteToken: string
    /** 客服按钮文字（默认：在线客服） */
    label?: string
  }
  group?: SiteGroup
  contacts?: {
    qq?: string
    email?: string
    teams?: string
    telegram?: string
  }
  infoUrl?: {
    /** 国内文档地址（必填） */
    cn: string
    /** 国外文档地址（必填） */
    en: string
    /** 国内文档（语雀）查看密码，若有则在界面上展示给用户 */
    cnPassword?: string
    /** 提示前缀文字（默认：{网站名}网站和群组信息：） */
    label?: string
    /** 国内查看链接文字（默认：国内查看） */
    cnLabel?: string
    /** 国外查看链接文字（默认：国外查看） */
    enLabel?: string
    /** 密码提示文字（默认：密码，展示为「（密码：xxx）」） */
    passwordLabel?: string
  }
}
