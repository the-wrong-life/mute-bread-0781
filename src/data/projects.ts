export type ProjectStatus = '进行中' | '已交付' | '规划中';
export interface ProjectLink { label: string; href: string; }
export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  domain: string;
  status: ProjectStatus;
  updated: string;
  stack: string[];
  problem: string;
  approach: string;
  steps: string[];
  results: string[];
  pending: string[];
  gaps: string[];
  links: ProjectLink[];
}

// 档案时间是本条记录的整理日期，不代表各项目的最新测试日期。
export const projects: Project[] = [
  {
    slug: 'project-nova', title: 'PROJECT NOVA', subtitle: '用可追溯的记录建设工程实验室网站',
    domain: '网站与工程记录', status: '进行中', updated: '2026-11-09', stack: ['Astro 7', 'TypeScript', '静态站点'],
    problem: '为工程项目、知识和工具建立统一入口，同时让验证状态与发布边界清晰可见。',
    approach: '以静态页面组织内容，使用隔离构建和浏览器抽查记录候选状态；不以本机预览代替生产验收。',
    steps: ['整理页面与导航，标明资料和内容缺口。', '在隔离副本执行依赖安装、静态检查与构建。', '针对不同视口开展浏览器验证，再检查部署环境及发布门禁。'],
    results: ['已实测：2026-11-08 干净副本记录中，静态检查 20 个文件无诊断，生成 7 个页面。', '已实测：2026-11-09 本机 Chrome 记录了 7 种视口的首页宽度与页面错误检查；这些结果不代表当前页面已复测。', '待验证：本次新增项目详情页的构建、浏览器表现与 ESA 预览。'],
    pending: ['核实 ESA 构建环境并完成非生产预览。', '补充跨浏览器、辅助技术与性能验证；发布仍需独立审批。'],
    gaps: ['缺少 ESA 非生产预览的构建日志及页面截图。', '缺少 Firefox、WebKit 与屏幕阅读器的完整验收记录。'],
    links: [{ label: '工程知识', href: '/docs' }, { label: '工程工具', href: '/tools' }]
  },
  {
    slug: 'yuheng-core', title: '玉衡核心', subtitle: '程序化三维模型与离线渲染双轨',
    domain: '三维与交互', status: '进行中', updated: '2026-11-10', stack: ['Three.js', 'GLB', 'Blender'],
    problem: '在保留青玉与铜金仪器意象的同时，让核心视觉既有实体质感，又不拖慢首屏。',
    approach: '程序化建模生成玉衡几何（球壳、衔尾蛇、玉轴、铜环、玉牌），导出 GLB 后在 Blender 重写材质与布光离线渲染，首页使用渲染图，/lab 保留实时可旋转版本。',
    steps: ['先做 SVG 与着色器原型，验证构图与降级策略。', '改写为 Three.js 程序化几何，逐部件命名分组。', '导出 GLB、导入 Blender、按材质名重写并渲染，最后打包为透明 WebP 接入首页。'],
    results: [
      '已实测（2026-11-10）：GLB 导出 2.45 MB，magic 为 glTF，14 个 mat-* 材质名在 Blender 中全部保留。',
      '已实测（2026-11-10）：Blender 4.5 LTS 导入并渲染 1400×1400 / 128 samples 单张约 60–90 秒；首页主视觉为 51 KB 透明 WebP（含 520w 备选）。',
      '已实测（2026-11-10）：本机 Chrome 在 1585/1440/390/360 四个视口检查，innerWidth 与 scrollWidth 相等，无 pageerror 与 requestfailed。',
      '历史记录（2026-11-09）：SVG 与 WebGL 原型阶段的多视口、暂停与降级检查；模拟生命周期不等同真实后台及往返缓存。'
    ],
    pending: ['蛇首细节、蛇身细鳞过渡与玉牌雕刻仍为简化实现。', '在真实低性能设备、真实后台切换和浏览器往返缓存场景下测试。'],
    gaps: ['缺少跨引擎（Safari / Firefox）与读屏器抽查记录。', '缺少目标设备长期性能与显存占用实测。'],
    links: [{ label: '工程知识', href: '/docs' }, { label: '工程工具', href: '/tools' }]
  },
  {
    slug: 'engineering-toolbox', title: '工程工具箱', subtitle: '单位换算、JSON 校验与文本整理，全部在浏览器本地运行',
    domain: '浏览器工具', status: '进行中', updated: '2026-11-10', stack: ['TypeScript', '单位换算', 'JSON', '本地处理'],
    problem: '日常沟通中常需快速换算单位、检查 JSON 语法或清理重复文本，也需要明确计算范围和不适用条件。',
    approach: '三个工具均在浏览器端处理，不上传输入；换算给出公式边界，JSON 校验给出行列与字符偏移，文本整理按行去重。结果仅供参考，不代替设备手册或专业验算。',
    steps: ['实现长度、质量、温度与功率换算，加入有限数字、范围与绝对零度检查。', '实现 JSON 校验、格式化与压缩，附语法错误的行列定位。', '实现按行去重与空白清理，并回归验证三种工具的边界输入。'],
    results: [
      '已实测（2026-11-10）：25.4 mm → 1 in；0 °C → 32 °F；输入 abc 提示「请输入有效的十进制数字。」并置 aria-invalid。',
      '已实测（2026-11-10）：1e20 提示「请输入绝对值不超过 1×10¹⁵ 的有限数字。」。',
      '已实测（2026-11-10）：JSON 非法输入 {"a":1,} 定位到第 1 行第 8 列（字符偏移 7）；格式化与压缩输出均正确。',
      '已实测（2026-11-10）：文本去重 alpha/beta/alpha/空/beta/gamma → alpha/beta/gamma。',
      '历史记录（2026-11-09）：隔离预览中 25.4 mm 曾换算为 2.54 cm、−300 °C 被拒绝。'
    ],
    pending: ['验证键盘操作与屏幕阅读器体验。', '补充压降、UPS 备用时间等工程计算器，公式需先经独立核对。'],
    gaps: ['缺少全部换算单位及边界值的覆盖清单。', '缺少屏幕阅读器实测记录。'],
    links: [{ label: '工程知识', href: '/docs' }, { label: '打开工具箱', href: '/tools' }]
  },
  {
    slug: 'engineering-notes', title: '工程知识与计算记录', subtitle: '先交代输入，再保留验证边界',
    domain: '知识与方法', status: '规划中', updated: '2026-11-09', stack: ['工程记录', '复现方法', '安全边界'],
    problem: '实验与计算若缺少输入、条件和依据，结果难以复核，也难以安全复用。',
    approach: '围绕输入、步骤、测量、误差、来源及适用范围组织知识；实际内容基于可核查资料逐步补充。',
    steps: ['整理记录结构与安全提示。', '收集原始数据、设备参数及计算依据。', '经过复核后发布可复现的文档。'],
    results: ['已创建：现有文档索引列出了实验记录、工具说明与安全清单的内容方向。', '待验证：具体计算案例、原始测量及复现结论尚未核实。'],
    pending: ['确定首批真实案例和负责人。', '补充来源、单位、误差和适用边界，并进行专业复核。'],
    gaps: ['缺少首批计算案例的原始数据、公式来源和设备参数。', '缺少实验记录、测量截图及专业验收文件。'],
    links: [{ label: '查看知识索引', href: '/docs' }, { label: '工程工具', href: '/tools' }]
  }
];
