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
    slug: 'yuheng-core', title: '玉衡核心', subtitle: '从动态视觉原型探索三维模型',
    domain: '三维与交互', status: '进行中', updated: '2026-11-09', stack: ['WebGL', 'SVG', 'Three.js'],
    problem: '在保留青玉与铜金仪器意象的同时，探索可交互、可降级的核心视觉。',
    approach: '现有原型为 SVG 与 WebGL 着色器混合实现；目标是用 Three.js 建立三维玉衡，导出 GLB 并导入 Blender 验证部件和材质。',
    steps: ['制作玉球及仪器视觉原型。', '实现动态控制、减少动态偏好和静态降级。', '探索三维模型、导出与建模软件互通，并保留可复现证据。'],
    results: ['已实测：本机 Chrome 与 Edge 曾进行多视口检查，记录无横向溢出，并检查暂停、降级和生命周期；模拟生命周期不等同真实后台及往返缓存。', '待验证：完整 Three.js 模型、GLB 导出及 Blender 导入结果，不能等同于现有 WebGL 与 SVG 原型。'],
    pending: ['继续完善三维材质和构图，并验证目标模型的导出与导入。', '在真实低性能设备、真实后台切换和浏览器往返缓存场景下测试。'],
    gaps: ['缺少 Three.js 建模脚本产物、GLB 导出文件和 Blender 导入截图。', '缺少 320 与 390 宽度首屏包含完整玉衡的参考对照截图，以及材质参数和目标设备长期性能测试记录。'],
    links: [{ label: '工程知识', href: '/docs' }, { label: '工程工具', href: '/tools' }]
  },
  {
    slug: 'engineering-toolbox', title: '工程工具箱', subtitle: '单位换算已实现，JSON 校验与文本整理在建',
    domain: '浏览器工具', status: '进行中', updated: '2026-11-09', stack: ['TypeScript', '单位换算', '本地处理'],
    problem: '日常沟通中常需快速换算单位，也需要明确计算范围和不适用条件。',
    approach: '单位换算由浏览器端处理输入并展示公式边界；JSON 校验与文本整理仍在建设。结果仅供参考，不代替设备手册或专业验算。',
    steps: ['实现长度、质量、温度与功率换算。', '加入有限数字、范围和绝对零度检查。', '对其他文本与数据处理功能补充实现及验证。'],
    results: ['已实测：历史隔离预览中 25.4 mm 换算为 2.54 cm，−300 °C 被拒绝。', '待验证：JSON 校验和文本整理的页面入口、交互与浏览器回归。'],
    pending: ['补充 JSON 校验与文本整理功能的独立测试。', '验证键盘、移动设备与屏幕阅读器体验。'],
    gaps: ['缺少 JSON 校验、文本整理的最终页面截图和测试记录。', '缺少全部换算单位及边界值的覆盖清单。'],
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
