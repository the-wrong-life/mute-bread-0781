export interface PostSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
  code?: string;
}
export interface Post {
  slug: string;
  title: string;
  /** 首发日期，YYYY-MM-DD。 */
  date: string;
  updated: string;
  category: string;
  summary: string;
  tags: string[];
  /** 本条记录的证据等级：写明哪些结论是实测、哪些仍是待验证。 */
  status: string;
  sections: PostSection[];
  sources: { label: string; note: string }[];
}

export const postCategories = ['工程验证', '视觉与渲染', '平台与安全'] as const;

// 每条札记都对应仓库里可核查的提交、脚本或实测记录；没有证据的推测不写成结论。
export const posts: Post[] = [
  {
    slug: 'three-layer-tool-verification',
    title: '工程计算器怎么才算验证过',
    date: '2026-11-11',
    updated: '2026-11-11',
    category: '工程验证',
    summary: '把十一个页面内工具拆成三层验证：独立参考实现、用例向量、浏览器实测，并明确每一层的失败判定。',
    tags: ['计算器', '单元测试', '独立复核', '验证记录'],
    status: '已实测：50 个数值用例与 38 个拒绝用例在本地全部通过，浏览器 66 项交互用例全部通过；未做现场仪表比对，也未覆盖非正弦工况。',
    sections: [
      {
        heading: '为什么"页面能算出数"不算验证',
        paragraphs: [
          '页面能返回一个数，只能说明代码跑通，不能说明公式、单位、边界和提示是对的。尤其是压降、UPS 备用时间、柜内散热这类工程估算，输入错一个单位、断面选错一次，结果就会偏到另一个量级，而界面上看起来完全正常。',
          '因此验证要回答四个问题：公式与单位是否正确、边界输入是否被拒绝、界面是否把结果显示在正确的位置、失败时是否存在可见提示。四者缺一，这个工具就还只是草稿。'
        ]
      },
      {
        heading: '第一层：独立参考实现',
        paragraphs: [
          '参考实现刻意与页面代码无关：用另一门语言重新写一遍公式，常数取 SI 精确值，不复用页面的任何函数或中间变量。这样两边的错误不会互相掩盖。',
          '参考脚本放在 tools/verify/oracle.py，输入同一份用例文件就输出期望值，便于随时重算。'
        ]
      },
      {
        heading: '第二层：用例向量与容差',
        paragraphs: [
          '用例文件 tools/verify/vectors.json 里同时存数值用例与拒绝用例。数值用例给出容差，拒绝用例只要求"必须报错"，不比对具体文案。',
          '容差取相对误差 1e-9 与绝对误差 1e-12 双条件，避免接近零的结果被相对误差放大成假失败。'
        ],
        table: {
          headers: ['类别', '数量', '判定'],
          rows: [
            ['数值用例', '34', '与参考实现差值在容差内'],
            ['拒绝用例', '22', '必须返回错误状态且不输出结果'],
            ['浏览器交互', '34', '示例值、边界报错、结果区与复制按钮一致']
          ]
        }
      },
      {
        heading: '第三层：浏览器实测',
        paragraphs: [
          '静态检查通过不代表页面能用。浏览器用例走真实点击与真实输入：填入示例值、触发边界报错、检查 aria-invalid、读取结果区文本、验证复制按钮写入剪贴板。同时在桌面与窄视口检查是否有横向溢出。',
          '实测中确认过一次容易被忽略的问题：把结果直接写进 input 的 value 时，读屏器仍会读旧值；改为写文本节点后才与视觉一致。'
        ]
      },
      {
        heading: '独立复核算出的一次真实分歧',
        paragraphs: [
          '复核方用另一种语言重算 30 个唯一用例，数值与页面完全一致，但指出六条边界需要写进文档：折弯角必须按平直转角理解（给内夹角时要取补角）、k=2 只适用于单程去回线、散热系数 3.12 隐含固定体积热容、温差不能做温标换算、UPS 备用时间是理想能量估算、电源容量公式只适用于正弦工况。',
          '其中一条直接纠正了我手算的中间值：某用例理论值为 7.985803046，我先前记录的 7.9863 是舍入错误，以复核算值为准。这类分歧正是独立复核的价值。'
        ]
      },
      {
        heading: '仍然没有验证的部分',
        paragraphs: [
          '当前验证覆盖的是"同一公式在两种实现下一致"。它不证明公式适用于具体现场：压降没有考虑实际敷设温度与并联校正，UPS 没有计入老化与负载倍率，散热没有做风机工作点匹配。',
          '因此工具页把这些前提写在每个工具的说明里，并标注为估算。工程结算与设备选型必须以现场条件和厂商数据复核。'
        ]
      }
    ],
    sources: [
      { label: '用例与参考实现', note: 'tools/verify/vectors.json、tools/verify/oracle.py、tools/ops/verify-tools.mjs' },
      { label: '验证记录', note: '/docs/tools-verification/' },
      { label: '计算口径', note: '/docs/calculation-record/' }
    ]
  },
  {
    slug: 'release-gate-in-practice',
    title: '一次发布门禁实际跑了什么',
    date: '2026-11-11',
    updated: '2026-11-11',
    category: '工程验证',
    summary: '把"发布前要测"写成可执行清单：候选工作树、类型检查、构建、链接、多视口审计、交互用例、线上核验与回滚标签。',
    tags: ['发布流程', '质量门禁', '回滚', '自动化检查'],
    status: '已实测：本批次走完整条链路并上线核验；回滚方案只做过标签与强制推送演练，未在真实故障中触发。',
    sections: [
      {
        heading: '为什么不在开发目录直接发',
        paragraphs: [
          '开发目录里有大量与发布无关的中间产物：渲染帧、对比图、实验脚本。直接推送等于让这些文件参与构建，构建结果不可复现。',
          '做法是另建一个候选工作树，基于生产分支创建，再把开发分支的树整体读进来。这样候选树的文件集合与将要上线的提交完全一致，构建与检查都在这个集合上执行。'
        ],
        code: 'git worktree add <candidate> -b <branch> origin/main --no-checkout\ngit -C <candidate> read-tree -u --reset <dev-sha>\n# 校验后在候选树提交并推送为生产分支'
      },
      {
        heading: '门禁的六个检查',
        paragraphs: [
          '每一项都必须给出可记录的输出，而不是"看起来正常"。失败即停，不带病上线。'
        ],
        list: [
          '类型检查：astro check 零错误，警告数与提示数记录在案。',
          '构建：页面数量与预期一致（新增内容后数字要同步更新）。',
          '内部链接：遍历构建产物的所有链接，问题数必须为 0。',
          '多视口审计：全部路由乘以四个视口，检查溢出、可见文本与图片加载。',
          '交互用例：计算器的示例、报错、复制与检索行为逐项执行。',
          '线上核验：发布后重新抓取关键路由，比对 canonical 与新增特征。'
        ]
      },
      {
        heading: '候选树上的真实数字',
        paragraphs: [
          '以批次 29 的门禁输出为例：类型检查 0 错误 0 警告 32 提示，构建 38 页，内部链接 40 条 0 问题，多视口审计 38 路由 × 4 视口共 152 组合 0 问题，交互用例 54 项全部通过。此后又加了交流压降、按压降选截面与穿管填充三个工具，最新读数为 50 个数值用例、38 个拒绝用例、66 项交互检查。',
          '2026-11-13 新增 UPS 后备时间算例后的复测：类型检查 0 错误 0 警告 39 提示，构建 42 页，文档 19 篇，站点地图 39 条 URL，文档索引 19 条、99,991 B，内部链接遍历 41 条路由、51 条链接，问题数 0；数值用例 50/50 与拒绝用例 38/38 仍全部通过。',
          '这些数字写进检查点文件，和提交哈希、回滚标签放在一起，事后可以复查当时到底测了什么。'
        ]
      },
      {
        heading: '发布与回滚',
        paragraphs: [
          '推送生产分支后，平台构建存在数分钟灰度期，因此线上核验要重复两到三次并比对新特征，单次测量容易误判成"没生效"。',
          '每次发布同时打两个标签：发布点与发布前回滚点。回滚是把回滚点强制推回生产分支，随后同样走线上核验。这个流程做过演练，但尚未在真实故障中执行过，因此回滚只算"已准备"，不算"已验证"。'
        ]
      },
      {
        heading: '门禁之外仍然会漏的东西',
        paragraphs: [
          '当前门禁覆盖静态构建与真实浏览器行为，但不覆盖：读屏器实际朗读顺序、真实低端手机的帧率、Safari 真机表现、以及需要平台控制台才能设置的响应头。',
          '这些项目在检查点里标为待验证，不用"应该没问题"替代结论。'
        ]
      }
    ],
    sources: [
      { label: '链接与审计脚本', note: 'tools/ops/check-links.mjs、_work/nova-audit-dev.mjs' },
      { label: '检查点', note: '_work/nova-night/checkpoint.json' }
    ]
  },
  {
    slug: 'who-overrides-my-material',
    title: '改了材质却没反应：谁在覆盖',
    date: '2026-11-10',
    updated: '2026-11-11',
    category: '视觉与渲染',
    summary: '三维资产从浏览器端导出到离线渲染时，材质可能被渲染脚本重新赋值。用材质索引图和对照组定位真正的覆盖者。',
    tags: ['Blender', 'Cycles', 'GLB', '排错方法'],
    status: '已实测：通过材质索引图定位到外壳自身与渲染脚本的硬编码覆盖；结论来自渲染产物与像素采样，不是推测。',
    sections: [
      {
        heading: '症状：参数改了，画面不变',
        paragraphs: [
          '几何与材质在浏览器端生成，再导出 GLB 交给 Cycles 离线渲染。连续几轮调整外壳基础色、吸收色和灯光色温，渲染结果几乎不变，颜色仍偏青绿。',
          '第一反应是"参数没生效"，第二反应是"灯光不参与"，两个都错。真实原因是渲染脚本里对外壳材质重新做了赋值，把导出的颜色覆盖掉了。'
        ]
      },
      {
        heading: '做法一：对照组',
        paragraphs: [
          '把所有可疑参数一次性设成极端值（例如纯红），看画面是否跟着变。变了，说明这条路径有效，问题在渐变方向；不变，说明被上游覆盖，继续往上游找。',
          '这个方法把搜索空间从"所有材质参数"缩到"这一条赋值链"，比逐个试参数快得多。'
        ]
      },
      {
        heading: '做法二：材质索引图',
        paragraphs: [
          '更彻底的办法是渲染一张"每个像素属于哪个材质"的图：给每个材质唯一颜色、关灯、关世界光，然后采样像素即可反查。',
          '用它确认了一件反直觉的事：画面中央那块占满球心的白色圆盘不是珍珠、不是内核球，而是外层玉壳自己。此前所有"调珍珠"的操作当然没有反应。'
        ],
        list: [
          '按材质（而不是对象）着色：一个对象可能有多个材质槽。',
          '渲染前先删掉固定光源，否则明暗会让同一材质出现多个颜色。',
          '采样时要先把 PNG 的 sRGB 值转成线性值，再与材质线性色比对。'
        ]
      },
      {
        heading: '连带发现的三个坑',
        paragraphs: [
          '一是每个变体必须有独立的输入目录：把多个变体指向同一帧文件，会得到几张完全相同的图，容易被误读成"参数无效"。',
          '二是页面预览服务的是构建产物，改了浏览器端源码后必须先重新构建再导出，否则导出的仍是旧几何。',
          '三是把多个查询参数拼成一条命令行时，某些 shell 会把 & 当命令分隔符，参数被丢掉却不一定报错。改成逐个参数传入才稳定。'
        ]
      },
      {
        heading: '结论与边界',
        paragraphs: [
          '离线渲染管线里，"所见即所得"不成立：颜色可能来自渲染脚本的赋值、可能来自世界光、也可能来自透明叠加。定位优先级应是从"谁最后写这个材质"往上游查，而不是从审美往参数上凑。',
          '这些结论只覆盖本项目的导出与渲染链路，换渲染器或换导出器需要重新验证。'
        ]
      }
    ],
    sources: [
      { label: '渲染脚本', note: 'tools/blender/render-loop.py' },
      { label: '几何构建', note: 'src/scripts/jade/build-jade.ts' },
      { label: '材质索引工具', note: '_work/nova-night/matmap.py' }
    ]
  },
  {
    slug: 'translucent-frames-gray-block',
    title: '半透明帧叠出来的灰块',
    date: '2026-11-10',
    updated: '2026-11-10',
    category: '视觉与渲染',
    summary: '首页动图下方出现一块灰色矩形。把滤镜、伪元素、DPR 逐一排除后，问题出在逐帧 alpha 与地面阴影的叠加。',
    tags: ['WebP 动画', 'alpha', '像素检查', 'CSS'],
    status: '已实测：修复前后整页截图对比确认灰块消失；静态图与动图两条路径分别处理。',
    sections: [
      {
        heading: '先缩小到图片本身',
        paragraphs: [
          '灰块只出现在艺术图下方，且形状规整。按顺序排除：CSS filter 关掉仍有、伪元素 display:none 仍有、换设备像素比仍有。到这里可以确定问题在像素数据，而不是样式。',
          '把动图逐帧解码成 RGBA 后看 alpha 通道，发现每帧底部都有一片 alpha 小于 250 的半透明阴影——这是渲染时留的地面投影。'
        ]
      },
      {
        heading: '为什么单帧不明显、叠起来很明显',
        paragraphs: [
          '单帧阴影很淡，看起来像柔和的环境光。但浏览器在动画播放时逐帧绘制，半透明像素会与页面底色反复混合；只要画面在该区域持续存在，累积后的视觉效果就是一块可见的灰色矩形。',
          '静态图有同样的问题，只是不累积：图像自带的阴影直接压在米色底上，边界清楚得像硬贴纸。'
        ]
      },
      {
        heading: '修复：两条路径分开处理',
        paragraphs: [
          '动图逐帧预处理：对 alpha 不足的像素把 RGB 溢出成页面底色，再对极小 alpha 直接归零。这样即使叠加，混合结果也等于底色。处理后可读体积同时下降。',
          '静态图换渲染设置：关掉地面阴影重新渲染，落影改由 CSS 椭圆承担，视觉上反而更可控——阴影可以随断点调整。'
        ],
        table: {
          headers: ['素材', '处理前', '处理后'],
          rows: [
            ['循环动图', '约 496 KB', '约 197 KB'],
            ['桌面静态图', '约 76 KB', '约 48 KB'],
            ['窄屏静态图', '约 31 KB', '约 25 KB']
          ]
        }
      },
      {
        heading: '顺带修掉的另一个问题',
        paragraphs: [
          '窄视口下阅读顺序原本是"标题、主视觉、按钮、导语"，按钮出现在导语之前，读起来像被打断。调整网格区域顺序后变为"标题、导语、主视觉、按钮"。',
          '这类问题不会出现在桌面截图上，只能按真实断点逐档检查。'
        ]
      }
    ],
    sources: [
      { label: '预处理脚本', note: '_work/nova-night/bleed.py' },
      { label: '首页组件', note: 'src/components/YuhengArt.astro' }
    ]
  },
  {
    slug: 'csp-and-injected-scripts',
    title: 'CSP 报错为什么指向一个陌生域名',
    date: '2026-11-10',
    updated: '2026-11-11',
    category: '平台与安全',
    summary: '控制台持续出现 Fetch 被拒。来源不是本站脚本，而是托管平台注入的统计脚本；处理方式是把上报域加入白名单，而不是放宽整条策略。',
    tags: ['CSP', 'ESA Pages', '控制台错误', '响应头'],
    status: '已实测：只放行单个上报域名时，下一轮核验又出现新域名；改为按最左标签通配后需重新核验。HSTS 与 X-Frame-Options 需平台控制台权限，仍待处理。',
    sections: [
      {
        heading: '现象',
        paragraphs: [
          '页面功能正常，但控制台每隔几秒出现一条 Fetch API cannot load 的错误，被拒的地址属于一个并不存在于本站源码的域名。',
          '排查顺序是：先在构建产物里搜该域名，没有；再看请求发起者，来自平台注入的统计脚本；最后核对策略，connect-src 只允许同源。'
        ]
      },
      {
        heading: '处理原则',
        paragraphs: [
          '第一步不是删掉 CSP，而是只把被注入脚本实际用到的域加进 connect-src，其余保持收紧。注入脚本的加载域与上报域通常是两个不同域名，只放行加载域仍然会报错；要看实际被拒的请求地址，而不是脚本标签里的地址。',
          '但逐个域名放行会反复失败：同一次核验里又出现了另两组域名，说明平台的统计端点按区域轮换。最终改为按最左标签通配，只放行这两个 CDN 域的子域，其余指令保持收紧。',
          '放宽的代价要写清楚：任何能在这两个 CDN 域下取得内容的第三方都可能成为数据外发目标。当前接受这一风险，是因为注入脚本由托管平台强制插入，且连接方向只涉及统计上报。'
        ],
        code: "meta http-equiv=\"Content-Security-Policy\"\n  content=\"default-src 'self';\n           script-src 'self' 'unsafe-inline' https://*.myalicdn.com;\n           connect-src 'self' https://*.myalicdn.com https://*.ialicdn.com; ...\""
      },
      {
        heading: '验证方式',
        paragraphs: [
          '改完不能只看"页面能打开"。要按路由重复加载并统计 pageerror 与 console error 数量，确认归零；同时确认没有放宽 script-src 之类会影响注入防护的指令。',
          '这批验证覆盖首页、知识库与工具页各两次加载，错误数为 0，且窄视口无横向溢出。'
        ]
      },
      {
        heading: '还没有做的部分',
        paragraphs: [
          '站点通过 meta 标签下发 CSP，能覆盖页面内的多数资源限制，但一些响应头级策略（HSTS、X-Frame-Options、frame-ancestors）必须由托管平台配置。',
          '当前没有平台控制台权限，这部分在检查点里保持"待验证"，不写成已启用。'
        ]
      }
    ],
    sources: [
      { label: '布局组件', note: 'src/layouts/NovaShell.astro' },
      { label: '部署说明', note: '/docs/seo-baseline/' }
    ]
  },
  {
    slug: 'mathml-without-js',
    title: '公式不引脚本：五段文档改用原生 MathML',
    date: '2026-11-11',
    updated: '2026-11-11',
    category: '工程验证',
    summary: '折弯、压降、电流、温标与 UPS 备用时间的公式改成浏览器原生 MathML：不引第三方运行时，禁用 JavaScript 仍能排版。',
    tags: ['MathML', '文档', '渐进增强', '体积'],
    status: '已实测：Chrome 在 1440 与 390 两视口下公式正常排版、页面无横向溢出、无控制台报错；禁用 JavaScript 后公式仍显示。Safari、Firefox 与读屏器朗读未实测。',
    sections: [
      {
        heading: '先问需不需要第三方公式库',
        paragraphs: [
          '给文档加公式，常见做法是引 KaTeX 或 MathJax：构建期渲染或运行时排版，效果稳定，但要额外下载运行时代码与数学字体，还要在无 JavaScript 时准备回退。',
          '本站当前的公式只有五处、结构简单（分式、根式、上下标、函数名），属于浏览器原生 MathML 能直接表达的范围。多引一个第三方运行时的收益，不足以抵消它的加载成本与升级维护面。'
        ]
      },
      {
        heading: '实现只有两处改动',
        paragraphs: [
          '第一处是文档数据类型加一个可选字段，第二处是详情页把它渲染出来。公式标记直接写在数据文件里，构建后就是静态 HTML，没有客户端解析步骤。',
          '注入的是仓库内的固定字符串，不接受任何用户输入，因此不构成 XSS 面；容器带 overflow-x:auto，窄屏下公式可以单独横向滚动而不撑破整页。'
        ],
        code: 'interface DocSection {\n  heading: string;\n  paragraphs: string[];\n  math?: string;   // MathML 标记\n  /* ... */\n}\n\n// src/pages/docs/[slug].astro\n{section.math && <div class="math" set:html={section.math} />}'
      },
      {
        heading: '实测读数',
        paragraphs: [
          '五篇文档各加一条到两条公式，逐页在 Chrome 下检查（1440 与 390 两视口，公式字号 20.8 px）：整页横向溢出为 0，公式容器自身也未溢出，无页面异常与控制台错误。高度是容器盒高，含上下内边距，因此大于单个公式的字号。',
          '体积上，卷绕后的标记很小：bend-allowance 页面 HTML 共 16,499 字节（含内联示意图），其中两条公式的 MathML 合计 412 字节。这个量级不需要为首屏缓存做任何额外设计。'
        ],
        table: {
          headers: ['页面', '公式', '渲染高度', '整页横向溢出'],
          rows: [
            ['/docs/calculation-record/', 'U = 2·I·L·ρ / A', '72 px', '0'],
            ['/docs/supply-current/', 'I = S / (√3·U)', '77 px', '0'],
            ['/docs/bend-allowance/', 'BA 与 OSSB 两式', '133 px', '0'],
            ['/docs/unit-conversion/', 'T/K = t/°C + 273.15', '72 px', '0'],
            ['/docs/ups-runtime/', 't = C·U·DoD·η / P', '72 px', '0']
          ]
        }
      },
      {
        heading: '代价与还没有验证的部分',
        paragraphs: [
          '代价是观感由浏览器决定：字形来自各家自带的数学字体，行距与根号的粗细在 Chrome 与 Firefox 下不完全一致。站点没有使用自定义数学字体，因此不追求像素级统一。',
          '复杂排版能力有限：多行对齐、公式编号、大括号分组需要手工写标记，超过这个复杂度就该换构建期渲染方案。本轮只用到了分式与根式。',
          '未验证的部分写清楚：Safari 与 Firefox 未实测，读屏器对 MathML 的朗读效果未验证。这两项留在检查点的待验证清单里，不作为已完成的结论。'
        ]
      }
    ],
    sources: [
      { label: '实现位置', note: 'src/data/docs.ts 的 math 字段与 src/pages/docs/[slug].astro 的渲染分支' },
      { label: '规范', note: 'https://www.w3.org/TR/mathml-core/' },
      { label: '浏览器支持参考', note: 'https://developer.mozilla.org/docs/Web/MathML' }
    ]
  },
  {
    slug: 'scoped-css-and-injected-svg',
    title: '注入的 SVG 不吃作用域样式：一次 612 像素的排查',
    date: '2026-11-11',
    updated: '2026-11-11',
    category: '视觉与渲染',
    summary: '文档里要放工程示意图，用内联 SVG 实现。样式写了 max-width:480px，实测却是 612px：原因是 set:html 注入的节点不带 Astro 的作用域属性。',
    tags: ['Astro', 'SVG', 'CSS 作用域', '调试'],
    status: '已实测：Chrome 1440 与 390 两视口。修复前后宽度与公式字号均有 getComputedStyle 读数对照。读屏器朗读未实测。',
    sections: [
      {
        heading: '示意图不引图表库',
        paragraphs: [
          '文档需要一张折弯截面图：内半径 R、料厚 T、折弯角 θ、外侧退让 OSSB 与中性层弧长 BA 的几何关系。这类图用内联 SVG 画最划算——矢量、可随主题改色、无脚本、无第三方运行时，构建后就是一段静态标记。',
          '图放在文档数据类型的新字段里（svg 与 svgCaption），由详情页用 set:html 注入。这样内容与排版分离，图表跟着正文一起进静态 HTML。'
        ]
      },
      {
        heading: '现象：样式写了 480，实际是 612',
        paragraphs: [
          '第一版图能画出来，但明显过大。用 getComputedStyle 读 SVG 的真实盒模型：maxWidth 是 none、宽度 612.015625 px、高 538.578125 px，而容器 figure 的宽度是 638.03125 px。也就是说 SVG 撑满了正文栏，max-width:480px 完全没生效。',
          '同时发现构建产物里确实有这条规则。把页面 HTML 取出来看，样式块中是 .figure-canvas[data-astro-cid-wyaoh547] svg[data-astro-cid-wyaoh547]{max-width:480px;...}。规则在，元素也在，但计算值是 none——说明选择器没匹配上。'
        ]
      },
      {
        heading: '根因：注入的节点没有作用域属性',
        paragraphs: [
          'Astro 的 scoped CSS 会把组件里的 class 选择器编译成带属性选择器的形式，并且给选择器里每个复合部分都追加 [data-astro-cid-*]。模板中直接写的标签会自动带上这个属性，于是选择器成立。',
          'set:html 注入的节点是运行时字符串，不经过模板编译，因此没有 data-astro-cid-* 属性。选择器要求 svg 自身也带该属性，匹配失败，规则被静默忽略：既不报错，也不进控制台。',
          '同一个原因让另一条规则也失效了：.math math{font-size:1.3em} 同样没命中，此前公式一直用浏览器默认字号。修好之后才读到 20.8px（16×1.3），因此公式容器的实测高度也跟着变了——之前记录的 33–49 px 是默认字号下的读数，已按新读数更正。'
        ],
        code: '/* 会失效：Astro 给 svg 也补上 [data-astro-cid-*] */\n.figure-canvas svg { max-width: 480px }\n.math math { font-size: 1.3em }\n\n/* 生效：注入内容用 :global() 跳出作用域 */\n.figure-canvas :global(svg) { max-width: 480px }\n.math :global(math) { font-size: 1.3em }'
      },
      {
        heading: '修复读数对照',
        paragraphs: [
          '改成 :global() 后，同一段探测脚本读到的 maxWidth 从 none 变成 480px，SVG 宽度 612 → 480 px，高度 539 → 422 px；公式字号 16 → 20.8 px。两视口整页横向溢出仍为 0，无控制台报错。'
        ],
        table: {
          headers: ['读数', '修复前', '修复后'],
          rows: [
            ['SVG max-width 计算值', 'none', '480px'],
            ['SVG 实际宽度', '612.02 px', '480.00 px'],
            ['SVG 实际高度', '538.58 px', '422.39 px'],
            ['公式 font-size', '16 px（默认）', '20.8 px'],
            ['整页横向溢出 1440 / 390', '0 / 0', '0 / 0']
          ]
        }
      },
      {
        heading: '图本身也要对得上公式',
        paragraphs: [
          '示意图画错比不画更糟。这张图按 1:1 的毫米比例画：水平边与垂直边各宽 20（料厚 T），内侧圆弧半径 60（内半径 R），外侧圆弧半径 80（R+T），中性层半径 68.8（K=0.44）。',
          'OSSB 的标注最容易画错。它量的是“虚拟尖角到切点”的距离，尖角取外侧两条边的延长线交点。本例 R=60、T=20、θ=90°，代入 (R+T)·tan(θ/2)=80·tan45°=80，图上那段水平尺寸线正是 80。若照内壁切线去量会得到 60，那是 R 而不是 OSSB。',
          '折弯角 θ 标在凸角一侧（两条边延长线之间），而不是标在材料内部的凹侧，避免读者把内夹角当成折弯角。'
        ],
        list: [
          '图宽高比按内容确定：viewBox 取 24 16 300 264，裁掉多余留白，避免缩放到 480 px 后出现大片空白',
          '所有线条与标注用同一组色值（描边 #3f604c、中性层 #a74432），与站点配色一致，不引入新的视觉语言',
          'role="img" 加 aria-labelledby 指向 title，SVG 在无障碍树中是一个有名称的图形而不是一堆路径',
          '容器带 overflow-x:auto，窄屏下 SVG 可独立横向滚动，不撑破整页'
        ]
      },
      {
        heading: '代价与还没验证的部分',
        paragraphs: [
          '代价是必须手工核对几何。SVG 只是标记，没有约束求解：标注位置、半径、角度都要按公式算过再落笔，改一个数字可能要连带改多处坐标。图多到一定数量时，应该换成由数据生成 SVG 的函数，而不是继续手写字符串。',
          '没验证的部分：读屏器对 role="img" 与 aria-labelledby 的实际朗读未实测；Safari 与 Firefox 下 MathML 与 SVG 的排版差异未实测。这些留在检查点的待验证清单里，不写成已完成。'
        ]
      }
    ],
    sources: [
      { label: '图所在文档', note: '/docs/bend-allowance/' },
      { label: '实现位置', note: 'src/data/docs.ts 的 svg 字段与 src/pages/docs/[slug].astro 的 figure 分支' },
      { label: 'Astro 样式作用域', note: 'https://docs.astro.build/en/guides/styling/#global-styles' }
    ]
  }
];

export const findPost = (slug: string): Post | undefined => posts.find((post) => post.slug === slug);
