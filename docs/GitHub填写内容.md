# GitHub 填写内容

以下为推荐填写稿。文案依据现有功能，不代表已经创建仓库或发布 Release。

## 推荐定位

**消息回完、电话挂断，刚才做到哪了？**

先代入「工作做到一半被消息、电话或临时任务叫走，回来忘了刚做到哪里」的情景，再介绍如何给自己留下继续做的线索。任务管理、计时、甘特图和本地单文件放在后面自然说明。特色来自具体工作方式，不声称某项功能首创。

工具保存用户写下的事项与计时时段。具体下一步可通过双击事项文字手动记下，不把这个使用方式宣传成自动捕获工作现场或自动记录每一步进度。

## 新建仓库

| GitHub 字段 | 填写内容 |
|---|---|
| Repository name（仓库名） | `day-threads` |
| Visibility（可见性） | 正式公开时选 Public |
| README / .gitignore / License | 使用代码包自带文件，无需重新生成；协议为 MIT |
| Website（网站） | `https://mackeychan12-tech.github.io/day-threads/demo.html`（已上线；须保留末尾的 `demo.html`，根地址会打开需要连接本地文件夹的正式版） |

Description（仓库简介，以下整段直接粘贴）：

```text
消息回完、电话挂断，刚才做到哪了？今日线程帮你找回手头的事：暂停后继续，今天没做完明天接着做。单 HTML 本地任务管理、分段计时与周甘特图。A local task manager for interrupted work: resumable time tracking, daily carry-over and weekly Gantt.
```

这段简介以中文交代使用价值，同时覆盖英文的 task manager、time tracking、Gantt 等常见功能词。它是内容策略建议，没有声称这些词的搜索量或排名效果。

## Topics（关键词标签）

在仓库 About 的 Topics 中逐个添加以下 12 个标签：

```text
task-management
time-tracking
gantt-chart
kanban
productivity
todo-list
local-first
offline
single-file
no-backend
work-log
vanilla-javascript
```

前六个表达用途，后六个补充本地、单文件和使用方式。这是填写时便于核对的分组，不代表 GitHub 会按此顺序增加权重。

## README 标题与开头

代码包中的中英文 README 已同步更新，中文标题为：

```text
Day Threads 今日线程｜被打断后，找回刚才那件事
```

标题下保留一句特色说明：

```text
消息回完、电话挂断，刚才做到哪了？
```

开头介绍：

```text
方案改到一半，同事发来消息；回完消息，又去处理了一个临时问题。等重新坐回来，刚才在做什么、下一步准备做什么，已经有点想不起来了。

今日线程把手头的事留在眼前：被打断时暂停，回来再继续，保留每次投入的时段；今天没做完，明天接着做。

这是一个支持分段计时、跨天接续和独立周甘特图的本地任务管理工具。不需要注册账号、安装依赖或配置后端。主程序是一个 HTML 文件，实际数据保存在你选择的文件夹里。
```

首张配图使用今日线程，保留多段时段条、昨日带来和运行／暂停混合状态；第二张再放周甘特图。包内图片均为虚构数据。

## 首个 Release

Tag（建议版本号）：

```text
v0.1.0
```

Release title（标题）：

```text
v0.1.0 · 今日线程：被打断后，找回刚才那件事
```

Release 正文可使用 [发布文案](发布文案.md) 中的首版草稿。主线依次为：暂停后继续、跨天带入、多段投入记录、单独的项目周安排、本地单文件使用。

## 关键词怎样分布

| 位置 | 重点 |
|---|---|
| 仓库名 | 固定品牌 `day-threads`，便于传播和记忆 |
| 简介 | 中断续做、跨天接续；task manager、time tracking、Gantt；单 HTML 与本地文件 |
| Topics | 与已实现用途和运行方式有关的英文标签 |
| README 标题与开头 | 标题代入被打断后忘记做到哪里的情景；开头自然写入本地任务管理、分段计时、周甘特图 |
| 功能和使用说明 | 未完成事项自动带入、并行计时、历史回看、日报、午休设置等具体功能 |

中文重点词：`本地任务管理`、`个人任务看板`、`中断续做`、`分段计时`、`跨天接续`、`周甘特图`、`单 HTML 文件`。

英文重点词：`task manager`、`task management`、`time tracking`、`resumable timers`、`daily carry-over`、`weekly Gantt chart`、`single-file`、`local-first`。

这些词应在解释功能时自然出现，不把同义词连续重复成一段。当前功能没有 AI、云同步、实时团队协作、准确考勤或计划与实际工时自动关联，文案和标签均不作这些承诺。

## 已核对的搜索规则

- GitHub 默认仓库搜索查名称、简介和 Topics；要搜索 README 内容，需要包含相应的 `in:readme` 范围。因此核心功能词同时写进简介和标签，不能只依赖 README。[GitHub 仓库搜索说明](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)
- Topics 使用小写字母、数字和连字符，每个不超过 50 个字符，每仓库最多 20 个；本稿提供 12 个。[GitHub Topics 规则](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
- Google 建议标题清楚、简洁并准确描述内容，避免重复堆词。GitHub 仓库页面的网页标题由平台生成；这里优化的是可编辑的名称、简介和 README，不把 README 标题当成可直接控制的搜索结果标题。[Google 标题建议](https://developers.google.com/search/docs/appearance/title-link)

以上有助于清楚表达内容、覆盖相关检索词，不保证收录时间、搜索排名或访问量。规则核对日期：2026-10-19。
