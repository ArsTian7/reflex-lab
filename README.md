# Reaction Lab · 反应速度实验室

一个纯静态的「反应速度测试 + 在线排行榜」网页，专门给电脑端用。屏幕先变红，随机等待后变绿，变绿瞬间点击，测 10 次取平均值（毫秒）。支持昵称、12 个内置动物头像或上传自己的图片，排行榜分**总排名榜**与**月排名榜**。

在线地址：<https://arstian7.github.io/reflex-lab/>

---

## 1. 功能一览

| 模块 | 说明 |
| --- | --- |
| 测试流程 | 红灯随机等待 1.1–3.2 秒后变绿，10 次一轮，取平均值 |
| 抢跑处理 | 红灯阶段点击 = 抢跑，该次作废并重测，不污染平均值 |
| 计时精度 | `performance.now()` 亚毫秒时钟；以「变绿那一帧」为起点；监听 `pointerdown` 而不是 `click` |
| 播放数据 | 平均 / 最快 / 最慢 / 波动 σ / 抢跑次数 / 评级，外加最近 20 次的走势图 |
| 头像 | 12 个手写 SVG 动物（猫、柴犬、熊猫、白兔、狐狸、棕熊、考拉、企鹅、猫头鹰、青蛙、小鸡、小猪），或上传图片（自动压到 96px / 约 3–8KB） |
| 排行榜 | 总榜 + 月榜（UTC+8 自然月），前三名领奖台，搜索、我的名次、个人成绩高亮 |
| 反作弊 | 拒绝 <55ms 的机器速度；昵称与设备双重频率限制；同名只保留最好成绩 |
| 提交可靠性 | 写入与读榜解耦；网络失败自动暂存本机，恢复联网后自动补交 |
| 管理后台 | 独立的 `admin.html`，密码登录后可删除成绩、封禁昵称/设备（见第 7 节） |
| 桌面优先 | 窄屏会给出提示（手机输入精度不够，成绩没有可比性） |

---

## 2. 本地预览

不需要任何构建工具，但因为浏览器对 `file://` 有安全限制，建议起一个本地服务器：

```bash
# 任选一种
python -m http.server 8000
npx serve .
```

然后打开 <http://localhost:8000>。

---

## 3. 开启在线排行榜

页面有一个「数据源适配器」，只改 [assets/js/config.js](assets/js/config.js) 里的一个字段就能切换。默认是 `local`：成绩只存在你自己浏览器里，页面顶部会显示黄色横幅提醒。

### 方案 A：Supabase（推荐，5 分钟，永久免费）

1. 打开 <https://supabase.com> → `Start your project` → 用 GitHub 账号登录（不需要信用卡）。
2. `New project` → 填名字（如 `reflex-lab`）→ Region 选 `Southeast Asia (Singapore)` → Create。
3. 左侧 `SQL Editor` → `New query` → 把 [supabase/schema.sql](supabase/schema.sql) 全文粘进去 → `Run`，看到 `Success` 即可。
4. 左侧 `Project Settings` → `API`（新版控制台叫 `API Keys`），复制**两个**值：

   | 要复制的值 | 长什么样 | 说明 |
   | --- | --- | --- |
   | `Project URL` | `https://abcdefghijkl.supabase.co` | 项目地址 |
   | `anon` `public` 密钥，或新版叫 `Publishable key` | `eyJhbGciOi...`（很长的一串 JWT）或 `sb_publishable_...` | 两种都支持，本来就是设计成可公开的密钥 |

   ⚠️ **绝对不要用** `service_role` 或 `Secret key`（`sb_secret_...`）——那是服务端密钥，放进网页等于公开数据库钥匙。本站前端内置了拦截：一旦发现是这类密钥，会自动拒绝启用在线模式，并在页面上提示你换掉。
5. 打开 [assets/js/config.js](assets/js/config.js)，改成：

```js
backend: 'supabase',
supabase: {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOi...你的 anon / publishable key',
  // 下面的保持默认
},
```

6. 提交并推送，等 GitHub Pages 自动重新部署（约 1 分钟），刷新页面。顶部的标签会变成绿色的「在线 · Supabase」，此时所有人的成绩都在同一个榜单里了。

> 数据库脚本已经做好了这些事：匿名只能插入和读取（不能改、不能删）、同一昵称每分钟最多 6 次提交、成绩范围校验、总榜/月榜视图、按速度建索引。

### 方案 B：Cloudflare Worker + D1（不想用 Supabase 时）

```bash
npm i -g wrangler
wrangler login
cd server
wrangler d1 create reflex-lab          # 把返回的 database_id 填进 wrangler.toml
wrangler d1 execute reflex-lab --file=d1-schema.sql --remote
wrangler deploy
```

拿到 `https://reflex-lab.xxx.workers.dev` 后，改 config.js：

```js
backend: 'rest',
rest: { baseUrl: 'https://reflex-lab.xxx.workers.dev' },
```

Worker 代码在 [server/cloudflare-worker.js](server/cloudflare-worker.js)，逻辑与 Supabase 版一致（校验、去重、频率限制、月榜）。

### 方案 C：只给自己玩

什么都不用配置，保持 `backend: 'local'`。榜单里会带 12 个演示玩家，方便看效果；成绩存在浏览器本地。

---

## 4. 常用自定义

全部集中在 [assets/js/config.js](assets/js/config.js)：

```js
trials: 10,          // 想改成 5 次或 20 次，改这里（页面上文案会自动跟随）
minValidMs: 55,      // 低于这个值视为无效点击（人类极限之下）
maxValidMs: 5000,    // 高于这个值视为走神
waitMinMs: 1100,     // 红灯最短等待
waitMaxMs: 3200,     // 红灯最长等待
boardLimit: 100,     // 榜单显示多少名
monthOffsetMinutes: 480,  // 月榜按哪个时区换月，480 = UTC+8
minSubmitMs: 120000, // 同一浏览器的提交冷却
repoUrl: '...',      // 页脚与顶栏的 GitHub 链接
```

想换配色，改 [assets/css/style.css](assets/css/style.css) 顶部 `:root` 里的变量（`--green` `--red` `--cyan` `--violet` 等）即可。

想增删动物头像，编辑 [assets/js/avatars.js](assets/js/avatars.js) 里的 `PRESETS` 数组，每一项就是一个动物（耳朵形状、毛色、五官都是参数化的）。

---

## 5. 计时原理（为什么成绩可信）

1. **起点取「屏幕真正变色」的那一帧。** 变绿的瞬间先记下逻辑时刻兜底，再用 `requestAnimationFrame` 的回调时间校准到实际绘制的那一帧，避免把「逻辑变色」当成「视觉变色」导致成绩虚高。
2. **终点用 `pointerdown`。** `click` 事件要等鼠标抬起才触发，会凭空多出几十毫秒；只用鼠标主键按下与空格键触发。
3. **拒绝不可能的数据。** 低于 55ms 的点击直接判无效并重测；这些数据也不会被服务器接受。
4. **屏幕刷新率会限制精度。** 60Hz 屏幕每帧 16.7ms，所以同一台电脑的成绩通常有 ±10ms 的自然抖动，页面顶部会显示实测刷新率供参考。
5. **硬件因素**：无线鼠标、省电模式、后台占满 CPU 都会让成绩明显变慢。想比出真实水平，用有线鼠标、关掉省电模式、让页面独占标签页。

---

## 6. 目录结构

```
reflex-lab/
├─ index.html                  单页应用（唯一入口）
├─ assets/
│  ├─ css/style.css            全部样式
│  ├─ favicon.svg
│  └─ js/
│     ├─ config.js             ← 你唯一需要改的文件
│     ├─ avatars.js            12 个动物头像的 SVG 生成器
│     ├─ store.js              本地存储与 UTC+8 时间工具
│     ├─ test.js               反应测试引擎（状态机 + 计时）
│     ├─ leaderboard.js        数据源适配器（local / supabase / rest）
│     ├─ ui.js                 渲染层
│     └─ app.js                主逻辑装配
├─ supabase/schema.sql         Supabase 建表脚本
├─ server/                     Cloudflare Worker 备选后端
└─ .nojekyll                   让 Pages 别用 Jekyll 处理这个仓库
```

## 7. 管理后台（删除成绩 / 封禁玩家）

地址：<https://arstian7.github.io/reflex-lab/admin.html>（没有从首页链接过去，防君子不防小人）

**第一次使用需要两步：**

1. Supabase → `SQL Editor` → 把 [supabase/admin.sql](supabase/admin.sql) 全文粘进去 → `Run`
2. 再把文件末尾「设置初始密码」那句注释取消、把密码换掉，单独跑一次：

```sql
insert into public.admin_secret (id, password_hash)
values (1, extensions.crypt('你的密码', extensions.gen_salt('bf', 10)))
on conflict (id) do update
  set password_hash = excluded.password_hash, updated_at = now();
```

**能做什么：**

| 操作 | 效果 |
| --- | --- |
| 删这条 | 删掉某一条成绩（比如手滑刷出来的） |
| 删他全部 | 删掉某个昵称的所有成绩 |
| 封禁 | 把昵称 + 设备指纹一起拉黑，他之后无法再提交（提交时会收到「已被管理员封禁」） |
| 解封 | 从黑名单移除 |
| 修改密码 | 不用再进 SQL Editor，页面上直接改 |

**安全性：**

- 密码只以 bcrypt 哈希存在 `admin_secret` 表里，该表开了 RLS 且没有任何策略——匿名角色根本读不到；所有管理操作都走数据库里的 `SECURITY DEFINER` 函数，前端绕不过密码校验。
- 连续输错 12 次锁定该 IP 10 分钟（按 `x-forwarded-for` 统计）。
- 登录成功后密码只存在本次会话（`sessionStorage`），关掉标签页即失效。
- 忘记密码：重跑上面那句 SQL 即可重置。

---

## 8. 提交失败是怎么回事

提交分两步：**① 写入成绩 → ② 刷新榜单**。两者是解耦的：

- 第 ① 步成功就立刻提示「已上榜」，第 ② 步失败只会提示「榜单刷新失败，稍后自动重试」，**不会再误报成提交失败**。
- 如果第 ① 步因为网络原因失败，成绩会**暂存在本机**（localStorage），提示里会写明「待补交 N 条」。恢复联网、切回页面、重新打开网站都会自动补交。
- 只有在数据本身被服务器拒绝（昵称重复提交过频、被管理员封禁、成绩超出可信范围）时，才提示真正的「提交失败」。

各类提示的含义：

| 提示 | 含义 | 怎么办 |
| --- | --- | --- |
| 连不上数据库 | 浏览器层面的请求失败：DNS、网络被拦（公司网 / 校园网 / 广告拦截插件）、页面被切到后台 | 换网络或换浏览器（无痕窗口最省事）；成绩已暂存，会自动补交 |
| 请求超时（12 秒） | 到 Supabase 的网络太慢 | 同上，成绩已暂存 |
| 密码 / 密钥无效 | config.js 里的 key 填错了 | 检查 anonKey |
| 找不到数据表或视图 | 没跑过 schema.sql | 去 SQL Editor 跑一次 |
| 数据库服务暂时不可用 | 免费项目闲置 7 天被暂停了 | Supabase 控制台点一下 Restore |
| 这个昵称或设备已被管理员封禁 | 被管理后台封了 | 找管理员 |

---

## 9. 常见问题

**Q：别人打开页面看到的是我的成绩吗？**
不会，除非你把它提交到了在线榜单。默认本地模式下每个人的榜单是各自浏览器里的。

**Q：anon key 放在公开的前端代码里安全吗？**
安全。Supabase 的 anon key 本来就是给浏览器用的，真正的防线是数据库的 RLS 策略：匿名角色只能 `select` 和 `insert`，无法 `update`/`delete`。所有写入都会经过约束与频率检查。

**Q：能让昵称只有本人能提交吗？**
不能做出强身份校验（站点没有登录系统）。现在用昵称 + 设备指纹做频率限制，对玩具排行榜够用。要更强的话可以接 Supabase Auth。

**Q：成绩比别的网站慢/快很多？**
不同网站对起点的定义不同（有的把「逻辑变色」当起点，实际会送你 10–30ms）。本站按屏幕真正变色计，属于偏严格的算法。

**Q：想换仓库名或域名？**
改 config.js 里的 `repoUrl`，并同步改 index.html 里页脚、顶栏、横幅上的链接。
