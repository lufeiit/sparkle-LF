import {
  Button,
  Input,
  InputGroup,
  Label,
  Modal,
  Separator,
  Surface
} from '@heroui-v3/react'
import React, { useState } from 'react'
import { BiHide, BiShow } from 'react-icons/bi'
import { IoCloudDownloadOutline, IoLogOutOutline } from 'react-icons/io5'
import { notify } from '@renderer/utils/notification'
import sites from '@renderer/assets/sites.json'

interface Props {
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  updateProfileItem?: (item: ProfileItem) => Promise<void>
  removeProfileItem?: (id: string) => Promise<void>
  onClose: () => void
  /** 已存在的订阅项（已登录则显示邮箱+登出） */
  item?: ProfileItem
}

/**
 * v2board 登录弹窗
 * - 未登录：显示邮箱/密码输入 + 登录按钮
 * - 已登录：显示邮箱 + 登出按钮
 * 站点地址与网站名来自打包配置（专属打包），不暴露给用户
 */
const V2BoardImportModal: React.FC<Props> = (props) => {
  const { addProfileItem, updateProfileItem, removeProfileItem, onClose, item } = props
  const existing = item?.v2board
  // 网站配置：优先使用传入订阅项的，否则用打包配置第一个网站（专属打包）
  const siteList = (sites as SiteConfig[]).filter((s) => s.name?.zh || s.name?.en)
  const configSite = siteList[0]
  const siteName = existing?.name?.zh || configSite?.name?.zh || '网站名'
  const apiSites = existing?.sites?.length
    ? existing.sites
    : existing?.site
      ? [existing.site]
      : (configSite?.apiSites ?? [])
  const isLoggedIn = Boolean(existing?.email && existing?.password)
  const [email, setEmail] = useState(existing?.email ?? '')
  const [password, setPassword] = useState(existing?.password ?? '')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [importing, setImporting] = useState(false)

  const canSubmit = email.trim() !== '' && password !== ''

  const handleSave = async (): Promise<void> => {
    if (!canSubmit || importing) return
    setImporting(true)
    try {
      const v2board: V2BoardAccount = {
        site: apiSites[0],
        sites: apiSites.length > 1 ? apiSites : undefined,
        email: email.trim(),
        password,
        name:
          existing?.name ||
          (configSite
            ? { zh: configSite.name.zh, en: configSite.name.en }
            : undefined)
      }
      if (item && updateProfileItem) {
        await updateProfileItem({ ...item, v2board })
      } else {
        await addProfileItem({
          name: siteName,
          type: 'v2board',
          v2board,
          autoUpdate: true
        })
      }
      onClose()
    } catch (e) {
      notify(e, { variant: 'danger' })
    } finally {
      setImporting(false)
    }
  }

  const handleLogout = async (): Promise<void> => {
    // 登出 = 删除该 v2board 订阅项（卡片、配置、凭据一并清除）
    if (item && removeProfileItem) {
      try {
        await removeProfileItem(item.id)
      } catch (e) {
        notify(e, { variant: 'danger' })
      }
    }
    onClose()
  }

  const renderField = (
    title: string,
    content: React.ReactNode
  ): React.ReactNode => {
    return (
      <Surface key={title} variant="transparent" className="flex flex-col">
        <div className="flex flex-col gap-1.5 py-2">
          <Label className="setting-item__title">{title}</Label>
          <div className="w-full min-w-0">{content}</div>
        </div>
        <Separator variant="tertiary" className="bg-default-100/70" />
      </Surface>
    )
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[min(600px,calc(100%-24px))] max-w-none">
            <Modal.Header className="app-drag pb-1">
              <Modal.Heading>{isLoggedIn ? siteName : `登录${siteName}`}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto pt-1 pb-2">
              {isLoggedIn ? (
                <Surface variant="transparent" className="flex flex-col">
                  {renderField(
                    '已登录账号',
                    <div className="rounded-lg border border-default-200 px-3 py-2 text-sm">
                      {existing?.email}
                    </div>
                  )}
                  <Surface variant="transparent" className="px-1.5 py-3">
                    <Button
                      variant="danger-soft"
                      fullWidth
                      isPending={importing}
                      onPress={handleLogout}
                    >
                      <IoLogOutOutline className="text-lg" />
                      登出
                    </Button>
                  </Surface>
                </Surface>
              ) : (
                <Surface variant="transparent" className="flex flex-col">
                  {renderField(
                    '邮箱',
                    <Input
                      aria-label="邮箱"
                      data-setting-input="edit-modal"
                      value={email}
                      variant="secondary"
                      placeholder="登录邮箱"
                      className="w-full"
                      onChange={(event) => {
                        setEmail(event.target.value)
                      }}
                    />
                  )}
                  {renderField(
                    '密码',
                    <InputGroup
                      data-setting-input="edit-modal"
                      variant="secondary"
                      className="w-full"
                    >
                      <InputGroup.Input
                        aria-label="密码"
                        type={passwordVisible ? 'text' : 'password'}
                        value={password}
                        placeholder="登录密码"
                        className="w-full"
                        onChange={(event) => {
                          setPassword(event.target.value)
                        }}
                      />
                      <InputGroup.Suffix>
                        <Button
                          aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          onPress={() => setPasswordVisible((visible) => !visible)}
                        >
                          {passwordVisible ? (
                            <BiHide className="text-lg" />
                          ) : (
                            <BiShow className="text-lg" />
                          )}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                  )}
                </Surface>
              )}
            </Modal.Body>
            <Modal.Footer className="app-nodrag">
              <Button variant="secondary" onPress={onClose} isDisabled={importing}>
                取消
              </Button>
              {!isLoggedIn && (
                <Button
                  variant="primary"
                  isDisabled={!canSubmit}
                  isPending={importing}
                  onPress={handleSave}
                >
                  <IoCloudDownloadOutline className="text-lg" />
                  登录
                </Button>
              )}
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default V2BoardImportModal
