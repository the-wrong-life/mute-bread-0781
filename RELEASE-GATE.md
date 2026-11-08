# PROJECT NOVA 鍙戝竷闂ㄧ璁板綍

鏇存柊鏃堕棿锛?026-11-08
绔欑偣锛歚www.token-xxo.cn`
寮€鍙戝垎鏀細`nova/v1-foundation`

## 褰撳墠缁撹

**NO-GO锛氫笉寰楀悎骞?`main`锛屼笉寰楀悜 ESA Pages 鍙戝竷銆?*

鏈褰曞彧鎻忚堪宸插彇寰楃殑鏈湴銆侀殧绂荤幆澧冨拰绾夸笂鍗曠偣璇佹嵁锛涗笉浠ｈ〃 ESA 棰勮鎴栫敓浜ч儴缃插凡缁忓畬鎴愩€?
## 宸查€氳繃鎴栭儴鍒嗛€氳繃

- 寮€鍙戝垎鏀繙绋嬫彁浜わ細`c906ae603696106fead104b043e60feb10f8da89`銆?- 鐢熶骇鍩虹嚎 main锛歚3c9faeca80fa8ef6255bfca681510dd8cd3be9be`銆?- 闅旂 npm 鏋勫缓锛歚astro check` 20 鏂囦欢銆? errors/warnings/hints锛涢潤鎬佺敓鎴?7 椤点€?- Astro 5 闅旂鍊欓€夛細`astro@5.18.2`锛宑heck 21 鏂囦欢鏃犻敊璇紝闈欐€佺敓鎴?7 椤点€?- Edge/Playwright 宸插彇寰楃殑鏈湴鐭╅樀锛?60銆?90銆?68銆?280銆?440銆?920锛涚洰鏍?7 璺敱 HTTP 200锛涘凡璁板綍鐨勮繍琛屼腑 console/pageerror 涓虹┖锛?68 棣栭〉妯悜婧㈠嚭宸蹭慨澶嶃€?- 宸ュ叿椤靛凡瀹炴祴鍗曚綅鎹㈢畻銆佺粷瀵归浂搴︽嫆缁濆拰鍔ㄦ€?`aria-invalid`銆?- 鐢熶骇鍗曠偣 HTTPS 瑙傚療涓?HTTP 200銆丼erver ESA锛涚敓浜т粛涓烘棫妯℃澘銆?
## 闃绘柇椤?
1. 鍘熸寮忛攣鏍戝璁′负 68 椤癸紙浣?銆佷腑33銆侀珮29銆佷弗閲?锛夛紝鐩存帴 Astro 浠嶅懡涓?AVIF 浼樺寲 RCE 鍏憡锛汚stro 5 鍊欓€夊璁′粛涓?17 椤逛笖淇濈暀涓ラ噸椤广€侫stro 7.4.7 + Tailwind 4.1.17 鐨勯殧绂诲€欓€夊凡灏嗗璁￠檷涓?椤癸紙浣?銆佷腑3銆侀珮2銆佷弗閲?锛夛紝骞堕€氳繃 21 鏂囦欢妫€鏌ュ強7椤甸潤鎬佹瀯寤猴紱浣嗗叾涓?Rollup 4.0.0鈥?.58.0 涓?Vite <=6.4.3 楂樺嵄浼犻€掍緷璧栧皻鏈畬鎴愬共鍑€閿佹枃浠堕噸寤恒€佽ˉ涓佺増鏈‘璁ゃ€侀瑙堝洖褰掑拰ESA鏋勫缓澶嶇幇銆傚洜姝や緷璧栨不鐞嗗拰鍙戝竷璇佹嵁浠嶆湭闂幆锛屼笉鑳界洿鎺ュ彂甯冦€?2. `package-lock.json` 涓?`pnpm-lock.yaml` 骞跺瓨涓旇В鏋愮増鏈紓绉伙紱灏氭湭閫夊畾鍞竴鍖呯鐞嗗櫒銆佸垹闄?淇濈暀閿佹枃浠跺苟瀹屾垚骞插噣閲嶅缓鍜屽鏍搞€?3. ESA GitHub 鍏宠仈銆侀潪鐢熶骇棰勮鍜岀湡瀹炲彂甯冨洖鎵у皻鏈彇寰楋紱鎺у埗鍙板仠鍦ㄧ櫥褰曢〉锛屾湭杈撳叆鍑嵁銆?4. Firefox/WebKit 鏈畨瑁呮垨鏈獙璇侊紱灞忓箷闃呰鍣ㄤ笌 Lighthouse 瀹炴祴璇佹嵁缂哄け銆?5. 鐢熶骇鏈瀵熷埌 HSTS銆丆SP銆乆-Content-Type-Options銆丷eferrer-Policy锛涘畨鍏ㄥご闇€瑕佸湪 ESA 鑳藉姏鍜岄瑙堢幆澧冧腑楠岃瘉鍚庡啀澶勭悊銆?6. 澶栭儴鐢熶骇鍙樻洿绁ㄦ嵁鏈彇寰楋紱涓嶅緱閫氳繃妯″瀷鎴栬剼鏈吉閫犵エ鎹€?
## 瑙ｉ攣椤哄簭

1. 鐢辩珯鐐硅礋璐ｄ汉鍦ㄨ摑鑹茶竟妗嗘祻瑙堝櫒瀹屾垚 ESA 鐧诲綍锛屽苟纭椤圭洰 `mute-bread-0781` 鐨?GitHub 鍏宠仈銆佹瀯寤哄懡浠ゅ拰棰勮鐩爣銆?2. 鍦ㄥ彂甯冨€欓€夊垎鏀€夋嫨鍞竴閿佹枃浠跺拰瀹夎鍣紝浣跨敤闅旂宸ヤ綔鏍戞墽琛屽共鍑€瀹夎銆佹瀯寤恒€佸璁★紱瀵规瘡涓弗閲?楂樺嵄鍏憡璁板綍鍙楀奖鍝嶈矾寰勩€佹槸鍚﹁繘鍏ユ瀯寤洪摼銆佷慨澶嶇増鏈拰娈嬩綑椋庨櫓銆?3. 鍙栧緱闈炵敓浜ч瑙?URL 鍚庯紝鎵ц鐩爣璺敱銆佸搷搴斿紡銆侀敭鐩樸€佽緟鍔╂妧鏈€佹帶鍒跺彴銆佹€ц兘涓庡畨鍏ㄥご楠屾敹銆?4. 鍙湁渚濊禆涓ラ噸椤规湁鏄庣‘澶勭疆銆侀瑙堝洖褰掗€氳繃銆佸閮ㄧエ鎹湁鏁堜笖鍥炴粴鐐瑰彲澶嶇幇鏃讹紝鎵嶅厑璁稿悎骞?main 鍜屽彂甯?ESA銆?5. 鍙戝竷鍚庨噸鏂版鏌?HTTPS銆佸唴瀹广€佸鑸€佸姩鐢汇€佺Щ鍔ㄧ銆佹帶鍒跺彴涓庢彁浜ゅ搱甯岋紱澶辫触鏃舵寜 `NOVA-BASELINE.md` 鐨?worktree 鍥炴粴娴佺▼鎭㈠锛岀姝㈠湪褰撳墠宸ヤ綔鏍戞墽琛?`git reset --hard`銆?
## 璇佹嵁杈圭晫

- 鏈褰曚笉澹扮О宸查儴缃层€佸凡閫氳繃 Lighthouse銆佸凡瀹屾垚 Firefox/WebKit 鎴栧睆骞曢槄璇诲櫒娴嬭瘯銆?- 鐢熶骇绔欑偣鏈慨鏀癸紝`main` 鏈悎骞躲€?- 涓嶆墽琛岃嚜鍔?`npm audit fix`銆佷笉浣跨敤 `--force`/`--legacy-peer-deps`锛屼笉鏂板浠樿垂鏈嶅姟锛屼笉鎵╁ぇ绯荤粺鏉冮檺銆?
## 2026-11-08 依赖候选复核补记

在隔离工作树 work/project-nova-astro7-check 中，将 @tailwindcss/vite 从 4.1.17 升至 4.3.5 后，确认该版 peer 范围包括 Vite 8（包元数据显示 ^5.2.0 || ^6 || ^7 || ^8），但完整干净安装仍解析出顶层 Vite 5.4.19，且其 esbuild 0.21.5 与 Astro 7.4.7 内部 Vite 8 声明的 ^0.27.0 || ^0.28.0 不兼容，npm ls vite rollup esbuild --all 退出状态为 ELSPROBLEMS。重复执行 npm ci --ignore-scripts --no-audit --no-fund 未消除该依赖树问题。该依赖树仍可运行 Astro check（21文件，零诊断）和 Astro build（静态7页），但可构建不代表依赖树符合发布标准。审计仍为5项：low0/moderate3/high2/critical0；高危 Rollup/Vite 修复和依赖树治理未完成。正式仓库未修改，门禁维持 NO-GO。

## 2026-11-08 18:22 依赖候选修正结果

继续在隔离工作树 work/project-nova-astro7-check 进行干净 npm ci 验证。移除 @tailwindcss/vite，改用 @tailwindcss/postcss@4.3.5，并新增独立 postcss.config.cjs；Astro 配置不再注册 Vite 插件。结果：npm ls vite rollup esbuild --all 仅保留 astro@7.4.7 -> vite@8.3.6，无 ELSPROBLEMS；astro check 22文件、0 errors/0 warnings/0 hints；astro build 静态7页成功；npm audit --package-lock-only 统计 low0/moderate2/high0/critical0。剩余两项为 Tailwind typography/postcss-selector-parser 的中危 CPU exhaustion 公告 GHSA-rj75-hqrm-r3gf，当前 fixAvailable 指向版本 0.5.4，需独立确认版本兼容后才可纳入正式仓库。

该结果只存在于隔离候选树，未修改正式仓库，不能视为已发布或已通过全部门禁。正式分支仍保留原依赖，双锁治理、候选变更审查、ESA预览与发布票据仍未完成。

## 2026-11-08 18:26 零漏洞 Astro 7 候选

在隔离工作树 work/project-nova-astro7-check 中，进一步移除未使用的 @tailwindcss/typography 及其 @plugin 声明。最终依赖方案为 astro@7.4.7、tailwindcss@4.3.5、@tailwindcss/postcss@4.3.5，使用 postcss.config.cjs，不使用 @tailwindcss/vite；Astro 配置保持 output: static。干净 npm ci 后，npm ls vite rollup esbuild --all 仅显示 astro@7.4.7 -> vite@8.3.6，未报告 invalid/ELSPROBLEMS；npm audit --package-lock-only 统计 total=0（low0/moderate0/high0/critical0）；astro check 22文件、0 errors/0 warnings/0 hints；astro build静态7页成功。

该候选未复制回正式工作树，正式分支仍为旧 Astro 4 双锁状态。下一步必须在正式分支创建独立提交并由独立审查复核 Tailwind 4 CSS 产物、浏览器矩阵和回滚路径，之后才可考虑预览。ESA 关联、外部发布票据、跨引擎/屏幕阅读器/Lighthouse 和生产响应头仍未满足，故整体门禁仍 NO-GO。

## 2026-11-08 18:39 编码修复与候选状态更正

已将本文件从错误的系统默认编码安全转换为 UTF-8；原始字节备份为 RELEASE-GATE.legacy-encoding.bak，不作为发布产物。更正：此前 Astro 7/Tailwind 4 候选的 audit=0、check=22、build=7 只对应候选完整依赖树；后续精简候选因 Windows EPERM unlink 原生 lightningcss 文件而损坏，当前不能复用旧结果。独立审查确认 global.css 未接入 NovaShell、旧 Tailwind 配置残留已移除插件引用，候选不得直接复制正式分支。门禁继续 NO-GO。