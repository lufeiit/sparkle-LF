import { useEffect, useRef } from 'react'
import sites from '@renderer/assets/sites.json'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { getV2BoardUserInfo } from '@renderer/utils/ipc'

/**
 * chatwoot 在线客服（原版 SDK）
 *
 * - 仅当存在已登录的 v2board 账户（email + password）时才显示客服
 * - 使用 chatwoot 原版 SDK（自带气泡 + 聊天窗口），不做自定义弹窗
 * - SDK 加载完成后，自动通过 v2board API 获取当前账户用户信息（以邮箱为准）推送给客服
 *
 * 配置位于 scripts/sites.ts 的 chatwoot.host / websiteToken / label，打包时可修改。
 */
declare global {
  interface Window {
    chatwootSettings?: {
      hideMessageBubble?: boolean
      position?: string
      type?: string
      launcherTitle?: string
      baseDomain?: string
    }
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void
    }
    $chatwoot?: {
      reset?: () => void
      setUser: (
        identifier: string,
        user: { email?: string; name?: string; avatar_url?: string }
      ) => void
      setCustomAttributes: (attrs: Record<string, string | number>) => void
    }
  }
}

const ChatwootButton: React.FC = () => {
  const { profileConfig } = useProfileConfig()
  const site = (sites as SiteConfig[]).find((s) => s.chatwoot?.host && s.chatwoot?.websiteToken)
  const chatwoot = site?.chatwoot
  const sdkLoadedRef = useRef(false)
  const userPushedRef = useRef(false)
  const prevLoggedInRef = useRef(false)

  // 是否有已登录的 v2board 账户
  const loggedIn = (profileConfig?.items ?? []).some(
    (i) => i.type === 'v2board' && i.v2board?.email && i.v2board?.password
  )

  // 清理 chatwoot SDK（登出 / 组件卸载时调用）
  const cleanupChatwoot = (): void => {
    try {
      // 清除 chatwoot cookie 与用户数据
      window.$chatwoot?.reset?.()
    } catch {
      // ignore
    }
    // 移除 SDK 注入的 DOM（气泡、聊天窗）
    document
      .querySelectorAll('.woot-widget-holder, .woot-widget-bubble')
      .forEach((el) => el.remove())
    // 移除 SDK script
    document.getElementById('chatwoot-sdk')?.remove()
    // 重置状态，允许重新登录后再次加载
    sdkLoadedRef.current = false
    userPushedRef.current = false
    window.chatwootSettings = undefined
    window.chatwootSDK = undefined
    window.$chatwoot = undefined
  }

  // 登录状态变化：登出时清理客服
  useEffect(() => {
    if (prevLoggedInRef.current && !loggedIn) {
      cleanupChatwoot()
    }
    prevLoggedInRef.current = loggedIn
  }, [loggedIn])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupChatwoot()
    }
  }, [])

  // 加载 chatwoot 原版 SDK（保留自带气泡）
  useEffect(() => {
    if (!chatwoot || !loggedIn || sdkLoadedRef.current) return
    sdkLoadedRef.current = true

    window.chatwootSettings = {
      hideMessageBubble: false,
      position: 'right',
      type: 'standard',
      launcherTitle: chatwoot.label || '在线客服',
      baseDomain: new URL(chatwoot.host).hostname
    }

    const script = document.createElement('script')
    script.id = 'chatwoot-sdk'
    script.src = `${chatwoot.host.replace(/\/$/, '')}/packs/js/sdk.js`
    script.async = true
    script.defer = true
    script.onload = () => {
      window.chatwootSDK?.run({
        websiteToken: chatwoot.websiteToken,
        baseUrl: chatwoot.host.replace(/\/$/, '')
      })
      // 延迟推送用户数据（等 SDK 初始化完成）
      setTimeout(() => {
        void pushUserData()
      }, 1000)
    }
    document.head.appendChild(script)
  }, [chatwoot, loggedIn])

  // 推送用户数据（以邮箱为准，通过 v2board API 查询）
  const pushUserData = async (): Promise<void> => {
    if (userPushedRef.current) return
    try {
      const result = await getV2BoardUserInfo()
      if (result.loggedIn && result.userInfo?.email && window.$chatwoot) {
        const info = result.userInfo
        const email = String(info.email)
        window.$chatwoot.setUser(email, {
          email,
          name: email.split('@')[0]
        })
        const attrs: Record<string, string | number> = {}
        if (typeof info.plan_name === 'string' && info.plan_name) attrs.plan = info.plan_name
        if (typeof info.expired_at === 'number') {
          attrs.expires = new Date(info.expired_at * 1000).toLocaleDateString('zh-CN')
        }
        if (typeof info.balance === 'number') attrs.balance = `${info.balance} 元`
        if (typeof info.commission_balance === 'number')
          attrs.commission_balance = `${info.commission_balance} 元`
        if (typeof info.device_limit === 'number') attrs.device_limit = info.device_limit
        if (typeof info.created_at === 'number') {
          attrs.v2board_registered_at = new Date(info.created_at * 1000).toLocaleDateString('zh-CN')
        }
        const transfer = typeof info.transfer_enable === 'number' ? info.transfer_enable : 0
        const used =
          (typeof info.u === 'number' ? info.u : 0) + (typeof info.d === 'number' ? info.d : 0)
        attrs.total_traffic = `${Math.round(transfer / 1024 / 1024 / 1024)} GB`
        attrs.used_traffic = `${Math.round(used / 1024 / 1024 / 1024)} GB`
        if (typeof info.telegram_id === 'string' && info.telegram_id) attrs.telegram_id = info.telegram_id

        if (Object.keys(attrs).length > 0) {
          window.$chatwoot.setCustomAttributes(attrs)
        }
        userPushedRef.current = true
      }
    } catch (e) {
      console.warn('[chatwoot] 推送用户信息失败:', e)
    }
  }

  // 未登录或未配置 chatwoot 时不渲染（SDK 也不加载）
  if (!chatwoot || !loggedIn) return null

  return null
}

export default ChatwootButton
