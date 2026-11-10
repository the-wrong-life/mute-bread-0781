export interface DocSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
  code?: string;
}
export interface Doc {
  slug: string;
  title: string;
  kind: string;
  summary: string;
  updated: string;
  sections: DocSection[];
  sources: { label: string; note: string }[];
  related: { label: string; href: string }[];
}
export const docs: Doc[] = [
  {
    slug: 'unit-conversion', title: '工程单位换算的边界与常见错误', kind: '基础参考', updated: '2026-11-09',
    summary: '区分量纲、温度与温差，记录换算因子来源，并保留有效数字。',
    sections: [
      { heading: '先确认量与单位', paragraphs: ['换算改变数值和单位，不改变同一物理量。先写出原始数值、单位、待转换单位及条件；量纲不一致时不能直接换算。带表压、绝压、额定工况等条件的数值，不能只靠比例因子完成解释。', '下表用于常见单位之间的数值换算。需要法律计量或合同结算时，应核对适用版本与约定。'], table: { headers: ['原单位', '换算', '说明'], rows: [['1 mm', '0.001 m', '长度'], ['1 kPa', '1 000 Pa', '压力'], ['1 bar', '100 000 Pa', '压力；注意绝压或表压'], ['1 kWh', '3.6 MJ', '能量，不是功率'], ['1 英制机械马力', '约 745.7 W', '不同马力定义不可混用']] } },
      { heading: '温度与温差不能混算', paragraphs: ['温标转换含偏移：摄氏温度 t 与开尔文温度 T 的关系为 T/K = t/°C + 273.15。温差没有这个偏移：1 °C 的温差等于 1 K 的温差。', '例如 20 °C 对应 293.15 K；温度从 20 °C 升至 30 °C，温差为 10 °C，也为 10 K，不能给温差再加 273.15。'] },
      { heading: '有效数字与舍入', paragraphs: ['换算过程中保留足够的中间位数，最后再按测量精度和用途舍入。换算因子的精确性不意味着原始测量值有更多有效数字；给定 2.5 kW（两位有效数字），换算成 2 500 W 后仍不能据此声称测量精确到 1 W。', '正式报告记录原值、因子、计算过程、最终位数及舍入规则；对安全限值和合规判定按相关标准或合同的规则处理。'] },
      { heading: '典型误用与算例', paragraphs: ['马力不是单一定义：机械马力、英制电马力及公制马力的定义不同；铭牌只写 hp 时先核对厂家定义及工况，不能默认互换。表压与绝压、交流功率的功率因数、体积流量的基准温压也应先明确。', '例：5.0 kPa × 1 000 Pa/kPa = 5 000 Pa；原始值为两位有效数字，若需避免歧义，可写作 5.0 × 10³ Pa。'] },
    ], sources: [{ label: '国际单位制手册（SI Brochure，BIPM）', note: 'https://www.bipm.org/en/publications/si-brochure' }, { label: 'NIST SP 811：SI 使用指南', note: 'https://www.nist.gov/pml/special-publication-811' }], related: [{ label: '查看工程工具', href: '/tools' }] },
  {
    slug: 'reusable-archives', title: '技术资料整理成可复用档案', kind: '资料方法', updated: '2026-11-09',
    summary: '以来源、版本、适用设备和失效状态为线索，让资料可以追溯和复查。',
    sections: [
      { heading: '定义档案边界', paragraphs: ['一份档案以可复核的对象为中心：记录设备或主题、型号、适用版本、维护责任人与最后复核日期。尚未确认的字段写“待核实”，不要根据相似型号补齐事实。', '资料应区分原始来源、转述、推导和现场实测；手册规定值不能写成设备的实测结果。'] },
      { heading: '命名与版本', paragraphs: ['文件名建议使用“对象_主题_版本_日期”，日期采用 YYYY-MM-DD。原始手册、清洗后的摘录与计算记录分开保存，避免覆盖；修订时记录变更内容和前一版本。'], list: ['记录制造商、文档号、版本、页码和获取日期。', '保留原始文件的校验值；确认版权与保密要求后再分享。', '从外部收到的新版本先核对适用型号和修订说明。'] },
      { heading: '资料与测量分层', paragraphs: ['设备手册层保存原始文档与适用章节；实测层记录设备编号、测试时间、仪器与校准状态、环境、原始读数及操作人。结论层给出计算和假设，并链接到前两层证据。', '无法确认来源或测量条件的数据标记“待核实”，不得用于冒充认证结果。'] },
      { heading: '检索、归档与失效', paragraphs: ['用主题、设备、型号、文档类别、关键词与状态建立索引；同时保留人可读的目录。为每条记录标注生效范围、复核日期及替代版本。', '过期资料不要直接删除：标记“已失效”或“仅供历史参考”，说明原因并链接替代记录。定期抽查引用是否仍可访问，并根据授权策略备份。'] },
    ], sources: [{ label: '方法说明', note: '本篇为工作方法建议，具体行业留存要求与设备资料版权应另行核实。' }], related: [{ label: '浏览项目', href: '/projects' }, { label: '工程工具', href: '/tools' }] },
  {
    slug: 'calculation-record', title: '工程计算记录方法', kind: '计算记录', updated: '2026-11-09',
    summary: '用六段式记录输入、公式、单位、假设、结果及复核；附直流线路压降示例。',
    sections: [
      { heading: '六段式结构', paragraphs: ['计算记录的目标不是只留下答案，而是让另一位工程人员能复算并判断边界。'], list: ['输入：记录已知值、来源、日期与精度。', '公式：写出公式及符号定义，标注适用范围。', '单位：统一单位并说明换算。', '假设：列出忽略项、边界条件及数据来源。', '结果：给出结果与合理舍入，不伪造测量精度。', '复核与失败条件：独立复算，明确哪些条件变化时结论失效。'] },
      { heading: '算例：24 V 直流线路压降', paragraphs: ['假设 24 V 直流负载电流 I = 5 A，电源到负载单程长度 L = 10 m，导体截面积 A = 2.5 mm²，铜电阻率 ρ ≈ 0.0175 Ω·mm²/m。使用 U = 2 × I × L × ρ / A；系数 2 表示去程和回程的相同导体长度。', '代入得 U = 2 × 5 × 10 × 0.0175 / 2.5 = 0.70 V，约为 24 V 的 2.9%；按上述假设，负载端电压约为 23.3 V。此值是示例计算，不代表实际设备测量。'], code: `U = 2 × I × L × ρ / A
  = 2 × 5 A × 10 m × 0.0175 Ω·mm²/m ÷ 2.5 mm²
  = 0.70 V` },
      { heading: '适用条件与复核', paragraphs: ['仅适用于直流两线、去回导体相同的简化电阻模型；忽略导体温升、接头电阻及电源内阻。单相交流同样有往返路径，但该例为直流，不能将其直接当作交流线路阻抗计算；交流还需结合电抗及功率因数等条件。', '校验实际电流、线路长度、接头、导体规格、温度和设备最低工作电压。电缆载流量、保护器件、短路与敷设条件应按适用规范另行校核；计算不替代专业设计、现场测量和验收。'] },
    ], sources: [{ label: 'NIST SP 811：单位与符号', note: 'https://www.nist.gov/pml/special-publication-811' }, { label: '铜电阻率示例值', note: '0.0175 Ω·mm²/m 为近似示例，实际应按导体材料、温度和适用标准核实。' }], related: [{ label: '查看工程工具', href: '/tools' }] },
  {
    slug: 'static-site-deployment', title: '静态网站部署实践', kind: '部署记录', updated: '2026-11-09',
    summary: '梳理 Astro 构建、ESA Pages 产物目录、发布前检查与回滚。',
    sections: [
      { heading: '构建与产物', paragraphs: ['当前仓库的 package.json 将 npm run build 定义为 astro check && astro build：先进行检查，再执行构建。astro.config.mjs 使用 output: static，并将构建资源放在 assets 目录。', '仓库的 esa.jsonc 指定安装命令 npm install，静态产物目录为 ./dist；这是配置事实，不代表当前线上部署已成功。'], code: `npm run build
# astro check && astro build
# 产物目录：./dist` },
      { heading: '分支与部署关系', paragraphs: ['将待发布改动提交到约定分支，确认生产环境绑定的分支、构建命令、运行时 Node 版本及部署目标；本仓库 esa.jsonc 未声明生产分支，平台实际绑定情况待核实。', '静态构建适用于无需运行时服务器的页面。新增加动态接口或私密数据前，重新评估平台能力、服务端边界和访问控制；不要把凭证放进静态文件。'] },
      { heading: '发布前检查', paragraphs: ['在隔离的验证环境检查，不把构建通过等同于线上验收。'], list: ['确认锁文件、Node 版本、构建命令与目标分支。', '运行检查与构建，检查 dist 目录和资源路径。', '逐页验证链接、移动端、搜索、可访问性及三维降级。', '确认无密钥、未授权资料或待核实内容误作事实。', '保存本次提交标识、构建日志与平台部署版本。'] },
      { heading: '回滚与复核', paragraphs: ['发布前保留上一个已验证的生产提交及平台部署版本。发生问题时，按平台实际能力恢复上一版本，或由授权人员将已知良好的提交重新构建发布；具体操作与权限以平台设置为准。', '恢复后核对页面与静态资源可访问，并记录故障、回滚时间和验证结果。平台是否支持一键回滚及具体步骤待现场核实。'] },
    ], sources: [{ label: '本仓库 package.json', note: '构建脚本：astro check && astro build。' }, { label: '本仓库 astro.config.mjs 与 esa.jsonc', note: '静态输出、assets 路径与 ./dist 配置；生产分支未在文件中指定。' }, { label: 'Astro 部署文档', note: 'https://docs.astro.build/en/guides/deploy/' }], related: [{ label: '查看项目', href: '/projects' }] },
];
