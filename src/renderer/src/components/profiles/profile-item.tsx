import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip
} from '@heroui/react'
import { Meter } from '@heroui-v3/react'
import { calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import V2BoardImportModal from './v2board-import-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openFile } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'
import QRCodeModal from '../base/base-qrcode-modal'

interface Props {
  info: ProfileItem
  isCurrent: boolean
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  updateProfileItem: (item: ProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  mutateProfileConfig: () => void
  onClick: () => Promise<void>
  switching: boolean
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}

const ProfileItem: React.FC<Props> = (props) => {
  const {
    info,
    addProfileItem,
    removeProfileItem,
    mutateProfileConfig,
    updateProfileItem,
    onClick,
    isCurrent,
    switching
  } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0
  const { appConfig, patchAppConfig } = useAppConfig()
  const { profileDisplayDate = 'expire' } = appConfig || {}
  const isRemote = info.type === 'remote' || info.type === 'v2board'
  const isV2Board = info.type === 'v2board'
  const v2boardLoggedIn = Boolean(isV2Board && info.v2board?.email && info.v2board?.password)
  const v2boardDisplayName = isV2Board
    ? v2boardLoggedIn
      ? info.v2board?.email || '未登录'
      : '未登录'
    : info?.name
  const [updating, setUpdating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: info.id
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [disableSelect, setDisableSelect] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [showV2BoardLogin, setShowV2BoardLogin] = useState(false)

  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
      {
        key: 'edit-info',
        label: '编辑信息',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'edit-file',
        label: '编辑文件',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'open-file',
        label: '打开文件',
        showDivider: !(isRemote && info.url),
        color: 'default',
        className: ''
      } as MenuItem,
      ...(isRemote && info.url
        ? [
            {
              key: 'qrcode',
              label: '二维码',
              showDivider: true,
              color: 'default',
              className: ''
            } as MenuItem
          ]
        : []),
      ...(isV2Board
        ? [
            v2boardLoggedIn
              ? ({
                  key: 'v2board-logout',
                  label: '登出账户',
                  showDivider: true,
                  color: 'danger',
                  className: 'text-danger'
                } as MenuItem)
              : ({
                  key: 'v2board-login',
                  label: '登录账户',
                  showDivider: true,
                  color: 'default',
                  className: ''
                } as MenuItem)
          ]
        : []),
      {
        key: 'delete',
        label: '删除',
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      } as MenuItem
    ]
    if (info.home) {
      list.unshift({
        key: 'home',
        label: '主页',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem)
    }
    return list
  }, [info])

  const onMenuAction = async (key: Key): Promise<void> => {
    switch (key) {
      case 'edit-info': {
        setOpenInfoEditor(true)
        break
      }
      case 'edit-file': {
        setOpenFileEditor(true)
        break
      }
      case 'open-file': {
        openFile('profile', info.id)
        break
      }
      case 'qrcode': {
        setShowQrCode(true)
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }
      case 'v2board-login': {
        setShowV2BoardLogin(true)
        break
      }
      case 'v2board-logout': {
        setConfirmLogoutOpen(true)
        break
      }

      case 'home': {
        open(info.home)
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setDisableSelect(true)
      return
    }

    const timer = window.setTimeout(() => {
      setDisableSelect(false)
    }, 160)

    return (): void => window.clearTimeout(timer)
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      className="grid col-span-1 touch-sortable-card"
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
    >
      {openFileEditor && (
        <EditFileModal
          id={info.id}
          isRemote={isRemote}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          isCurrent={isCurrent}
          onClose={() => setOpenInfoEditor(false)}
          updateProfileItem={updateProfileItem}
        />
      )}
      {showQrCode && info.url && (
        <QRCodeModal title={info.name} url={info.url} onClose={() => setShowQrCode(false)} />
      )}
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除配置？"
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={() => {
            removeProfileItem(info.id)
            mutateProfileConfig()
          }}
        />
      )}
      {confirmLogoutOpen && (
        <ConfirmModal
          onChange={setConfirmLogoutOpen}
          title="确认登出账户？"
          confirmText="确认登出"
          cancelText="取消"
          onConfirm={async () => {
            // 登出 = 删除该 v2board 订阅项
            await removeProfileItem(info.id)
            mutateProfileConfig()
          }}
        />
      )}
      {showV2BoardLogin && (
        <V2BoardImportModal
          item={info}
          addProfileItem={addProfileItem}
          updateProfileItem={updateProfileItem}
          onClose={() => setShowV2BoardLogin(false)}
        />
      )}
      <Card
        as="div"
        fullWidth
        isPressable
        onPress={() => {
          if (disableSelect || switching) return
          setSelecting(true)
          onClick().finally(() => {
            setSelecting(false)
          })
        }}
        className={`${isCurrent ? 'bg-primary' : ''} ${selecting ? 'blur-sm' : ''}`}
      >
        <div {...attributes} {...listeners} className="w-full h-full">
          <CardBody className="pb-1">
            <div className="flex justify-between h-8 gap-1">
              <div className="flex min-w-0 items-center">
                <h3
                  title={v2boardDisplayName}
                  className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-8 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {v2boardDisplayName}
                </h3>
              </div>
              <div className="flex shrink-0" data-no-dnd onClick={(e) => e.stopPropagation()}>
                {isRemote && (
                  <Tooltip placement="left" content={dayjs(info.updated).fromNow()}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="default"
                      disabled={updating}
                      onPress={async () => {
                        if (isV2Board && !v2boardLoggedIn) {
                          setShowV2BoardLogin(true)
                          return
                        }
                        setUpdating(true)
                        await addProfileItem(info)
                        setUpdating(false)
                      }}
                    >
                      <IoMdRefresh
                        color="default"
                        className={`${isCurrent ? 'text-primary-foreground' : 'text-foreground'} text-[24px] ${updating ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </Tooltip>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore
                        color="default"
                        className={`text-[24px] ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                      />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu onAction={onMenuAction}>
                    {menuItems.map((item) => (
                      <DropdownItem
                        showDivider={item.showDivider}
                        key={item.key}
                        color={item.color}
                        className={item.className}
                      >
                        {item.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
            {isRemote && extra && (
              <div
                className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
                {profileDisplayDate === 'expire' ? (
                  <Button
                    size="sm"
                    variant="light"
                    className={`h-5 p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'update' })
                    }}
                  >
                    {extra.expire ? dayjs.unix(extra.expire).format('YYYY-MM-DD') : '长期有效'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="light"
                    className={`h-5 p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'expire' })
                    }}
                  >
                    {dayjs(info.updated).fromNow()}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
          <CardFooter className="pt-0">
            {isRemote && !extra && (
              <div
                className={`w-full mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`}
                >
                  {info.type === 'v2board' ? 'v2board' : '远程'}
                </Chip>
                {info.type === 'v2board' && (
                  <small className="truncate pl-2">
                    {v2boardLoggedIn ? info.v2board?.email : '未登录'}
                  </small>
                )}
                <small>{dayjs(info.updated).fromNow()}</small>
              </div>
            )}
            {info.type === 'local' && (
              <div
                className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`}
                >
                  本地
                </Chip>
              </div>
            )}
            {extra && (
              <Meter aria-label="流量用量" maxValue={total} value={usage}>
                <Meter.Track
                  className={
                    isCurrent
                      ? 'h-2.5 bg-black/22 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]'
                      : undefined
                  }
                >
                  <Meter.Fill
                    className={
                      isCurrent
                        ? 'bg-(--color-accent-foreground) shadow-[0_0_8px_rgb(255_255_255/0.45)]'
                        : undefined
                    }
                  />
                </Meter.Track>
              </Meter>
            )}
          </CardFooter>
        </div>
      </Card>
    </div>
  )
}

export default ProfileItem
