/**
 * 网站配置打包脚本
 *
 * 读取 scripts/sites.ts 中的网站配置清单，生成 sites.json 打进应用
 * 供前端展示（网站名 / 主页 / 群组 / 客服信息等）。
 *
 * 专属打包：设置环境变量 SITE 指定网站 id，一次打包就是一个网站的专属配置
 *   例：SITE=lufei pnpm build:linux
 * 未设置 SITE 时（如 dev）生成全部网站配置。
 *
 * 用法：
 *   pnpm generate:sites                    # 生成全部
 *   SITE=lufei pnpm generate:sites         # 只生成路飞云专属配置
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { sitesConfig } from './sites'

// 渲染进程可直接 import 的 JSON（Vite 会打包进应用）
const outFile = join(process.cwd(), 'src/renderer/src/assets/sites.json')

function main(): void {
  const siteId = process.env.SITE?.trim()
  const selected = siteId ? sitesConfig.filter((s) => s.id === siteId) : sitesConfig
  if (siteId && selected.length === 0) {
    console.error(`[generate-sites] 未找到网站配置: "${siteId}"`)
    console.error(`  可用网站: ${sitesConfig.map((s) => s.id).join(', ')}`)
    process.exit(1)
  }

  mkdirSync(dirname(outFile), { recursive: true })
  const json = JSON.stringify(selected, null, 2)
  writeFileSync(outFile, json, 'utf-8')
  console.log(
    `[generate-sites] 已生成 ${outFile}（${selected.length} 个网站${siteId ? `，专属: ${siteId}` : ''}）\n` +
      selected.map((s) => `  - ${s.id}: ${s.name.zh} / ${s.name.en}`).join('\n')
  )
}

main()
