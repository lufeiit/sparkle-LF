/** 从 v2board 账户获取网站名：Sparkle 界面为中文，优先使用中文名 */
export function getV2BoardSiteName(account?: V2BoardAccount): string {
  if (account?.name?.zh) return account.name.zh
  if (account?.name?.en) return account.name.en
  const site = account?.site || account?.sites?.[0]
  if (!site) return 'v2board'
  try {
    return new URL(site).hostname
  } catch {
    return site
  }
}

/** 获取 v2board 候选站点地址列表 */
export function getV2BoardSites(account?: V2BoardAccount): string[] {
  if (!account) return []
  if (account.sites?.length) return account.sites
  if (account.site) return [account.site]
  return []
}
