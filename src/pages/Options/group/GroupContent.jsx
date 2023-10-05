import React, { memo, useEffect, useState } from "react"

import { Button, Checkbox, Input, notification } from "antd"

import { LocalOptions } from ".../storage/local"
import { storage } from ".../storage/sync"
import { isAppExtension } from ".../utils/extensionHelper"
import { appendAdditionInfo } from ".../utils/extensionHelper"
import { isExtensionMatch } from ".../utils/searchHelper"
import { getLang } from ".../utils/utils"
import ExtensionItems from "../components/ExtensionItems"
import { AlreadyFixedTipStyle, GroupContentStyle } from "./GroupContentStyle"

const { Search } = Input

const GroupContent = memo(({ group, groupList, extensions, options }) => {
  const [notificationApi, notificationContextHolder] = notification.useNotification()

  // 在分组中的扩展
  const [containExts, setContains] = useState([])
  // 没有在分组中的扩展
  const [noneGroupExts, setNoneGroupExts] = useState([])

  // 显示到界面的，在分组中的扩展（配合搜索功能）
  const [shownContainExts, setShownContainExts] = useState([])
  // 显示到界面的，没有在分组中的扩展（配合搜索功能）
  const [shownNoneGroupExts, setShownNoneGroupExts] = useState([])
  // 搜索词
  const [searchWord, setSearchWord] = useState("")

  // 未分组扩展中，不显示固定分组的扩展
  const [hiddenFixedGroupInNoneGroup, setHiddenFixedGroupInNoneGroup] = useState(false)
  // 未分组扩展中，不显示隐藏分组的扩展
  const [hiddenHiddenGroupInNoneGroup, setHiddenHiddenGroupInNoneGroup] = useState(false)
  // 未分组扩展中，不显示其它分组的扩展
  const [hiddenOtherGroupInNoneGroup, setHiddenOtherGroupInNoneGroup] = useState(false)

  // 初始化
  useEffect(() => {
    // 包含在当前分组中的扩展
    const containsExts =
      group?.extensions?.map((id) => extensions.find((e) => e.id === id)).filter((ext) => ext) ?? []
    const containsExtIds = containsExts.map((ext) => ext.id)

    // 剩余未分组：展示不在当前分组中的扩展（至于这些分组是不是在其他分组中，不考虑。一个扩展可以放在多个分组中）
    const noneGroupedExtensions = extensions
      .filter((ext) => !containsExtIds.includes(ext.id))
      .filter((ext) => !isAppExtension(ext))

    // 为每个扩展附加其所在分组的信息
    const extMap = new Map(extensions.map((ext) => [ext.id, ext]))
    for (const group of groupList ?? []) {
      for (const extId of group.extensions ?? []) {
        const ext = extMap.get(extId)
        if (ext) {
          ext.__group_ids__ = ext.__group_ids__ ?? []
          ext.__group_ids__ = [...ext.__group_ids__, group.id]
        }
      }
    }

    storage.management.get().then((managementOptions) => {
      setContains(appendAdditionInfo(containsExts, managementOptions))
      setNoneGroupExts(appendAdditionInfo(noneGroupedExtensions, managementOptions))
      setShownContainExts(containsExts)
      setShownNoneGroupExts(noneGroupedExtensions)
    })
  }, [group, groupList, extensions])

  // 搜索
  useEffect(() => {
    // 过滤 [不在此分组] 中的扩展
    const filterNoneGroupExts = (exts) => {
      return exts
        .filter((e) => {
          return !hiddenFixedGroupInNoneGroup || !e.__group_ids__?.includes("fixed")
        })
        .filter((e) => {
          return !hiddenHiddenGroupInNoneGroup || !e.__group_ids__?.includes("hidden")
        })
        .filter((e) => {
          let groupIds = e.__group_ids__ ?? []
          groupIds = groupIds.filter((id) => id !== "fixed").filter((id) => id !== "hidden")
          return !hiddenOtherGroupInNoneGroup || !groupIds.length > 0
        })
    }

    if (!searchWord || searchWord.trim() === "") {
      setShownContainExts(containExts)
      setShownNoneGroupExts(filterNoneGroupExts(noneGroupExts))
      return
    }

    const shownContainExts = containExts.filter((ext) => isExtensionMatch(ext, searchWord))
    const shownNoneGroupExts = noneGroupExts.filter((ext) => isExtensionMatch(ext, searchWord))
    setShownContainExts(shownContainExts)
    setShownNoneGroupExts(filterNoneGroupExts(shownNoneGroupExts))
  }, [
    searchWord,
    containExts,
    noneGroupExts,
    hiddenFixedGroupInNoneGroup,
    hiddenHiddenGroupInNoneGroup,
    hiddenOtherGroupInNoneGroup
  ])

  // 保存分组中的扩展记录
  const save = async (contains) => {
    const duplicateGroup = { ...group }
    duplicateGroup.extensions = contains.map((ext) => ext.id)
    storage.group.update(duplicateGroup)
  }

  // 搜索
  const onSearch = (value) => {
    setSearchWord(value)
  }

  if (!group) {
    return null
  }

  return (
    <GroupContentStyle>
      {notificationContextHolder}
      <Search
        className="search"
        placeholder="search"
        onSearch={onSearch}
        onChange={(e) => onSearch(e.target.value)}
      />
      <h3 className="group-name-title group-include-title">
        {getLang("group_include", group.name)}
      </h3>
      {buildExtContainer(shownContainExts, true)}

      <div className="group-not-include-header">
        <h3 className="group-name-title group-not-include-title">{getLang("group_not_include")}</h3>
        <Checkbox
          checked={hiddenFixedGroupInNoneGroup}
          onChange={(e) => setHiddenFixedGroupInNoneGroup(e.target.checked)}>
          {getLang("group_not_include_hidden_fixed")}
        </Checkbox>
        <Checkbox
          checked={hiddenHiddenGroupInNoneGroup}
          onChange={(e) => setHiddenHiddenGroupInNoneGroup(e.target.checked)}>
          {getLang("group_not_include_hidden_hidden")}
        </Checkbox>
        <Checkbox
          checked={hiddenOtherGroupInNoneGroup}
          onChange={(e) => setHiddenOtherGroupInNoneGroup(e.target.checked)}>
          {getLang("group_not_include_hidden_other")}
        </Checkbox>
      </div>

      {buildExtContainer(shownNoneGroupExts, false)}
      <p className="desc">{group.desc}</p>
    </GroupContentStyle>
  )

  function buildExtContainer(shownItems, isGrouped) {
    const onIconClick = (e, item) => {
      if (isGrouped) {
        const contain = containExts.filter((ext) => ext.id !== item.id)
        const none = [...noneGroupExts, item]
        setContains(contain)
        setNoneGroupExts(none)
        save(contain)
      } else {
        const none = noneGroupExts.filter((ext) => ext.id !== item.id)
        const contain = [...containExts, item]
        setContains(contain)
        setNoneGroupExts(none)
        save(contain)
        showAlreadyFixedTip(item)
      }
    }

    // 是否显示固定分组的小圆点标记
    const shouldShowFixedPin = (item) => {
      if (!options.setting.isShowDotOfFixedExtension) {
        return false
      }

      if (isGrouped && group.id === "fixed") {
        return true
      }

      const fixedGroup = groupList.find((g) => g.id === "fixed")
      return fixedGroup?.extensions?.includes(item.id)
    }

    // 如果扩展已经在固定分组中，在将扩展添加到其它分组时，给个提示 issues #36
    const showAlreadyFixedTip = async (item) => {
      if (group.id === "fixed") {
        return // 固定分组中的操作不管
      }
      if (!options.setting.isRaiseEnableWhenSwitchGroup) {
        return // 切换分组时，不执行扩展的启用与禁用，则不用提示
      }

      const local = new LocalOptions()
      const isShowAlreadyFixedTip = await local.getValue("isShowAlreadyFixedTip")
      if (isShowAlreadyFixedTip === false) {
        return
      }

      const textKnow = getLang("got_it")

      const onTipClick = (e) => {
        if (e.target.innerText === textKnow) {
          notificationApi.destroy("repeat-notification")
        }
      }

      const onClosePrompt = async () => {
        await local.setValue("isShowAlreadyFixedTip", false)
        notificationApi.destroy("repeat-notification")
      }

      if (groupList.find((g) => g.id === "fixed")?.extensions?.includes(item.id)) {
        // 扩展已经在固定分组中，切换分组时扩展将始终被激活
        // The extension is already in a fixed group. When switching groups, the extension will always be activated.
        notificationApi.info({
          message: getLang("group_may_redundant"),
          key: "repeat-notification",
          duration: 6,
          onClick: onTipClick,
          description: (
            <AlreadyFixedTipStyle>
              <p>{item.name}</p>
              <p>{getLang("group_may_redundant_desc")}</p>
              <div>
                <Button className="btn-already-fixed-tip">{textKnow}</Button>
                <Button className="btn-already-fixed-tip" onClick={onClosePrompt}>
                  {getLang("no_more_prompts")}
                </Button>
              </div>
            </AlreadyFixedTipStyle>
          ),
          placement: "topRight"
        })
      }
    }

    return (
      <ExtensionItems
        items={shownItems}
        onClick={onIconClick}
        placeholder="none"
        options={options}
        showFixedPin={shouldShowFixedPin}
        footer={otherGroupInfoFooter}></ExtensionItems>
    )
  }

  // 显示扩展所在的其它分组
  function otherGroupInfoFooter(item) {
    if (!groupList) {
      return null
    }

    const names = groupList
      .filter((g) => {
        if (!g.extensions) {
          return false
        }
        return g.extensions.includes(item.id)
      })
      .filter((g) => g.id !== "fixed")
      .filter((g) => g.id !== "hidden")
      .filter((g) => g.id !== group.id)
      .map((g) => g.name)

    return (
      <div className="other-group-info-container">
        {names.map((n) => {
          return (
            <div key={n} className="other-group-info-name">
              {n}
            </div>
          )
        })}
      </div>
    )
  }
})

export default GroupContent
