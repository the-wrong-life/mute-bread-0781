import * as THREE from 'three';

/**
 * 玉质着色器：用可控的光学模型替代 MeshPhysicalMaterial 的 transmission。
 *
 * 为什么不用 transmission：在深色背景下，transmission 采样的是"背后有什么"，
 * 无法表达"玉本身是什么"——薄了就变白玻璃，厚了就发暗，反复调参都跳不出塑料感。
 * 参考图里球体真正成立的是四件事，这里逐项直接用公式表达：
 *   1. 正对视线处最薄 → 透出内部暖白光核
 *   2. 斜侧处最厚 → 沉积成深墨绿玉肉
 *   3. 轮廓边缘的菲涅尔亮环（玉器的"水头"）
 *   4. 上方一道柔和镜面高光（工业产品的漆面感）
 * 另叠加低频絮状噪声模拟玉的棉絮与色根。
 */
export function createJadeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // 半透明玉壳：depthWrite 关闭，让内部玉轴/内核透出来；
    // 深度测试保留，所以蛇环绕到球背后会自然被玉肉压暗，空间关系才成立。
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uCoreColor: { value: new THREE.Color('#fffaea') },
      uMidColor: { value: new THREE.Color('#2f7a5c') },
      uEdgeColor: { value: new THREE.Color('#123f2c') },
      uRimColor: { value: new THREE.Color('#dcfff0') },
      uLightDir: { value: new THREE.Vector3(0.34, 0.82, 0.46).normalize() },
      uCorePower: { value: 0.26 },
      uRimPower: { value: 2.1 },
      uSpecPower: { value: 34.0 },
      uEnv: { value: null as THREE.Texture | null },
      uEnvIntensity: { value: 0.85 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      varying vec3 vPosW;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosW = worldPos.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDirW = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uCoreColor;
      uniform vec3 uMidColor;
      uniform vec3 uEdgeColor;
      uniform vec3 uRimColor;
      uniform vec3 uLightDir;
      uniform float uCorePower;
      uniform float uRimPower;
      uniform float uSpecPower;
      uniform sampler2D uEnv;
      uniform float uEnvIntensity;
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      varying vec3 vPosW;

      // 三维值噪声：模拟玉的棉絮与色根，低频、低振幅
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(vViewDirW);
        float facing = clamp(dot(N, V), 0.0, 1.0);

        // 1+2. 中心透光 → 侧面沉积深玉
        float body = smoothstep(0.0, 0.62, facing);
        vec3 col = mix(uEdgeColor, uMidColor, body);
        // 中心暖白光核，只在正对处出现，范围收窄，避免整球发白
        float coreGlow = pow(facing, 9.0) * uCorePower;
        col += uCoreColor * coreGlow;

        // 2b. 球面方向光：没有这一项，整颗球在任何角度都是一个平涂圆盘
        float ndl = max(dot(N, uLightDir), 0.0);
        col += uMidColor * ndl * 0.34 + uCoreColor * pow(ndl, 3.0) * 0.08;

        // 3. 菲涅尔边缘亮环：玉器的水头
        float fres = pow(1.0 - facing, uRimPower);
        col += uRimColor * fres * 0.30;

        // 4. 上方柔和镜面高光
        vec3 H = normalize(uLightDir + V);
        float spec = pow(max(dot(N, H), 0.0), uSpecPower);
        col += vec3(1.0, 0.99, 0.95) * spec * 0.22;

        // 絮状纹理：只在玉肉区可见，不污染光核与边缘
        float cloud = fbm(vPosW * 2.4);
        float vein = smoothstep(0.52, 0.78, cloud) * (1.0 - coreGlow * 1.4) * (1.0 - fres * 0.7);
        col = mix(col, col * 0.74 + uMidColor * 0.40, vein * 0.55);

        // 4b. 画出来的内部层次（用户第 1 条）：
        // 在暖白页面上做真透明，中心会被背景的白色直接冲掉，读成"奶白玻璃球"。
        // 因此把内部结构画进外壳的着色函数：中央暖白光核、内层玉胎的边界环、竖直玉轴的亮带。
        // 真实的内珠/玉轴/内层网格仍在场景里，负责旋转时的视差与 /lab 的结构检查。
        float rho = clamp(length(vPosW.xy), 0.0, 1.0);
        // 中央暖白光核：范围大、边缘软，是"球心里有光"的主体
        float core = smoothstep(0.30, 0.0, rho);
        col = mix(col, uCoreColor, core * 0.17);
        // 热核：范围更小、接近纯暖白，保证"球心里有一颗灯"读得出来
        float hot = smoothstep(0.105, 0.0, rho);
        col = mix(col, vec3(1.0, 0.975, 0.90), hot * 0.50);
        // 内层玉胎边界：rho≈0.74 处一圈略深的玉肉，形成第二层壁的视觉
        float innerEdge = smoothstep(0.70, 0.745, rho) * smoothstep(0.80, 0.755, rho);
        col = mix(col, uEdgeColor * 1.35 + uMidColor * 0.25, innerEdge * 0.42);
        // 竖直玉轴：x 近似为 0 的一条软亮带
        float axisBand = smoothstep(0.018, 0.006, abs(vPosW.x)) * smoothstep(0.90, 0.62, abs(vPosW.y));
        col += vec3(0.78, 0.90, 0.82) * axisBand * 0.05;

        // 5. 环境反射：玉器表面必须映出环境，否则永远像塑料。
        // 用等距柱状投影手动采样，自由度比 envMap 更高。
        vec3 R = reflect(-V, N);
        vec2 euv = vec2(atan(R.z, R.x) * 0.15915494 + 0.5, asin(clamp(R.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 envCol = texture2D(uEnv, vec2(euv.x, 1.0 - euv.y)).rgb;
        float refl = pow(1.0 - facing, 1.35);
        col += envCol * (0.01 + refl * 0.42) * uEnvIntensity;

        // 极轻的暗角，让球体压住画面重心
        col *= mix(0.45, 1.0, body);

        // 厚度感即透明度：中心最薄最透，边缘最厚接近实心
        // 用户第 1 条要求"恢复内部层次"：中心必须真的能透过去看到内珠与玉轴，
        // alpha 中心 0.26、边缘 0.90，玻璃壁的"厚"只保留在轮廓上。
        // 近不透明：暖白页面上做真透明会把球心冲成背景白，玉肉必须自己撑住颜色
        float alpha = mix(0.88, 0.985, smoothstep(0.15, 0.95, facing));
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}