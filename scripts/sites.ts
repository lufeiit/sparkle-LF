/**
 * 网站配置清单（多机场管理）
 *
 * 每个网站单独设置参数，后续新增网站只需在此文件追加一条配置。
 * 打包时由 scripts/generate-sites.ts 生成 sites.json 打进应用。
 */

export interface SiteGroup {
  name: string
  url: string
}

export interface SiteConfig {
  /** 唯一标识（英文小写） */
  id: string
  /** 网站名（中英文） */
  name: { zh: string; en: string }
  /** v2board API 候选地址（自动逐个检测，取可用） */
  apiSites: string[]
  /** chatwoot 客服配置（host 为 chatwoot 服务地址，websiteToken 为站点客服 key） */
  chatwoot?: {
    host: string
    websiteToken: string
    /** 客服按钮文字（默认：在线客服） */
    label?: string
  }
  /** 网站/群组信息文档查看地址（信息会变，展示处提示点击查看） */
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

export const sitesConfig: SiteConfig[] = [
  {
    id: 'lufei',
    name: { zh: '路飞云', en: 'LufeiCloud' },
    apiSites: [
      'http://103.236.77.114:53651/lufei',
      'http://47.103.130.251:33651/lufei',
      'http://112.8.207.240:33651/lufei',
      'http://103.97.176.99:18182/lufei',
      'http://154.12.18.186:18182/lufei',
      'http://103.116.246.169:18182/lufei'
    ],
    infoUrl: {
      cn: 'https://www.yuque.com/jefflewis/dxmwfu/zttgx31gg811howp',
      cnPassword: 'brad',
      en: 'https://sway.cloud.microsoft/MG3JKNnxAVuuQAnZ?ref=Link',
      label: '路飞云网站和群组信息：',
      cnLabel: '国内查看',
      enLabel: '国外查看',
      passwordLabel: '密码'
    },
    chatwoot: {
      host: 'https://chatwoot.sub-you.top',
      websiteToken: 'AyHjX336YHpPyezFnKk5m5ch',
      label: '在线客服'
    }
  },
  {
    id: 'mitu',
    name: { zh: '迷途云', en: 'StrayCloud' },
    apiSites: [
      'http://47.103.130.251:28612/mitu',
      'http://103.236.77.114:58612/mitu',
      'http://112.8.207.240:28612/mitu',
      'http://103.97.176.99:18181/mitu',
      'http://154.12.18.186:18181/mitu',
      'http://103.116.246.169:18181/mitu'
    ],
    infoUrl: {
      cn: 'https://www.yuque.com/jefflewis/dxmwfu/lxvz3lmpwiotb6tm',
      cnPassword: 'ui5y',
      en: 'https://sway.cloud.microsoft/0Nm8DAdaImTzhtgK?ref=Link',
      label: '迷途云网站和群组信息：',
      cnLabel: '国内查看',
      enLabel: '国外查看',
      passwordLabel: '密码'
    },
    chatwoot: {
      host: 'https://chatwoot.sub-you.top',
      websiteToken: 'iwEeuaDaxAkL4sLqW4boTybF',
      label: '在线客服'
    }
  }
]
