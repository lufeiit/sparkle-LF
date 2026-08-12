import axios from 'axios'
import { getUserAgent } from '../utils/userAgent'

// 内置支持的 v2board API 前缀（不同部署前缀不同，按优先级自动探测）
// 参考本地项目：/lufei（多数）、/api/v1（标准）、/mitu、/api/v2
const V2BOARD_API_PREFIXES = ['/lufei', '/api/v1', '/mitu', '/api/v2']

export interface V2BoardLoginResult {
  authData: string
  /** 完整可用的 API 基地址（含前缀），如 http://1.2.3.4:53651/lufei */
  apiBase: string
}

function normalizeSite(site: string): string {
  return site.trim().replace(/\/+$/, '')
}

/** 根据站点地址生成候选 API 基地址（已含已知前缀则直接用，否则探测各前缀） */
function buildBaseCandidates(site: string): string[] {
  const normalized = normalizeSite(site)
  if (!normalized) return []
  const hasKnownPrefix = V2BOARD_API_PREFIXES.some((p) => normalized.endsWith(p))
  if (hasKnownPrefix) {
    return [normalized]
  }
  return [normalized, ...V2BOARD_API_PREFIXES.map((p) => `${normalized}${p}`)]
}

/**
 * 登录 v2board 面板，自动探测可用地址与 API 前缀
 * 依次尝试所有候选站点地址，直到找到可用的
 */
export async function v2boardLogin(account: V2BoardAccount): Promise<V2BoardLoginResult> {
  if (!account.email || !account.password) {
    throw new Error('v2board 账户信息不完整（邮箱 / 密码）')
  }

  const sites = (account.sites?.length ? account.sites : account.site ? [account.site] : []).filter(
    Boolean
  )
  if (sites.length === 0) {
    throw new Error('v2board 站点地址不能为空')
  }

  let lastError: Error | null = null
  for (const site of sites) {
    for (const base of buildBaseCandidates(site)) {
      let res
      try {
        res = await axios.post(
          `${base}/passport/auth/login`,
          { email: account.email, password: account.password },
          {
            headers: { 'User-Agent': await getUserAgent() },
            timeout: 15000
          }
        )
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            // 路径不存在，尝试下一个候选
            continue
          }
          if (!error.response) {
            // 网络错误（无法连接/超时），该地址不可用，尝试下一个
            lastError = toV2BoardError(error)
            continue
          }
          // 有 HTTP 响应（地址可达）但登录失败，直接抛出（换地址无意义）
          throw toV2BoardError(error)
        }
        throw error
      }

      const data = res.data?.data
      const authData = data?.auth_data ?? data?.token ?? res.data?.auth_data
      if (!authData) {
        const message = res.data?.message || res.data?.msg || '登录失败'
        throw new Error(`v2board 登录失败：${message}`)
      }
      return { authData, apiBase: base }
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error('所有 v2board 站点地址均无法连接，请检查站点地址是否正确')
}

/**
 * 获取 v2board 订阅链接（每次调用都会生成新的 token，可规避阅后即焚）
 * apiBase 由登录时探测得到
 */
export async function v2boardGetSubscribe(apiBase: string, authData: string): Promise<string> {
  let res
  try {
    res = await axios.get(`${apiBase}/user/getSubscribe`, {
      headers: {
        Authorization: authData,
        'User-Agent': await getUserAgent()
      },
      timeout: 15000
    })
  } catch (error) {
    throw new Error(`获取 v2board 订阅链接失败：${errorMessage(error)}`)
  }

  const subscribeUrl = res.data?.data?.subscribe_url
  if (!subscribeUrl) {
    const message = res.data?.message || res.data?.msg || '返回数据异常'
    throw new Error(`获取 v2board 订阅链接失败：${message}`)
  }
  return subscribeUrl
}

/**
 * 获取 v2board 用户信息（邮箱、套餐到期、流量、余额、设备数等）
 * 用于推送给客服系统（以邮箱为准识别用户）
 */
export interface V2BoardUserInfo {
  email: string
  /** 总流量额度（字节） */
  transfer_enable?: number
  /** 已用上传（字节） */
  u?: number
  /** 已用下载（字节） */
  d?: number
  /** 到期时间戳（秒） */
  expired_at?: number
  /** 注册时间戳（秒） */
  created_at?: number
  /** 余额（元） */
  balance?: number
  /** 佣金余额（元） */
  commission_balance?: number
  /** 设备数上限 */
  device_limit?: number
  /** Telegram 绑定 ID */
  telegram_id?: string | null
  /** 套餐 ID */
  plan_id?: number
  /** 套餐名 */
  plan_name?: string
  [key: string]: unknown
}

export async function v2boardGetUserInfo(apiBase: string, authData: string): Promise<V2BoardUserInfo> {
  let res
  try {
    res = await axios.get(`${apiBase}/user/info`, {
      headers: {
        Authorization: authData,
        'User-Agent': await getUserAgent()
      },
      timeout: 15000
    })
  } catch (error) {
    throw new Error(`获取 v2board 用户信息失败：${errorMessage(error)}`)
  }
  const info = res.data?.data ?? res.data
  if (!info || !info.email) {
    const message = res.data?.message || res.data?.msg || '返回数据异常'
    throw new Error(`获取 v2board 用户信息失败：${message}`)
  }
  return info as V2BoardUserInfo
}

function toV2BoardError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const message = error.response.data?.message || error.response.data?.msg
      if (message) return new Error(`${message}（HTTP ${error.response.status}）`)
      if (error.response.status === 500) return new Error(`v2board 登录失败（HTTP 500）`)
      return new Error(`v2board 登录失败（HTTP ${error.response.status}）`)
    }
    return new Error(`v2board 登录请求失败：${errorMessage(error)}`)
  }
  return new Error(`v2board 登录请求失败：${error instanceof Error ? error.message : String(error)}`)
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNREFUSED') {
      return '无法连接站点服务器'
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return '请求超时'
    }
    if (error.code === 'ENOTFOUND') {
      return '站点域名无法解析'
    }
    if (error.response) {
      const message = error.response.data?.message || error.response.data?.msg
      if (message) return `${message}（HTTP ${error.response.status}）`
      return `HTTP ${error.response.status}`
    }
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}
