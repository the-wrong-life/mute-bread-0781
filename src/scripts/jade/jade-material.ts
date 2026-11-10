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
      uMidColor: { value: new THREE.Color('#4e9a76') },
      uEdgeColor: { value: new THREE.Color('#14432f') },
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
        float body = smoothstep(0.0, 0.92, facing);
        vec3 col = mix(uEdgeColor, uMidColor, body);
        // 中心暖白光核，只在正对处出现，范围收窄，避免整球发白
        float coreGlow = pow(facing, 9.0) * uCorePower;
        col += uCoreColor * coreGlow;

        // 3. 菲涅尔边缘亮环：玉器的水头
        float fres = pow(1.0 - facing, uRimPower);
        col += uRimColor * fres * 0.55;

        // 4. 上方柔和镜面高光
        vec3 H = normalize(uLightDir + V);
        float spec = pow(max(dot(N, H), 0.0), uSpecPower);
        col += vec3(1.0, 0.99, 0.95) * spec * 0.5;

        // 絮状纹理：只在玉肉区可见，不污染光核与边缘
        float cloud = fbm(vPosW * 2.4);
        float vein = smoothstep(0.52, 0.78, cloud) * (1.0 - coreGlow * 1.4) * (1.0 - fres * 0.7);
        col = mix(col, col * 0.82 + uMidColor * 0.3, vein * 0.35);

        // 5. 环境反射：玉器表面必须映出环境，否则永远像塑料。
        // 用等距柱状投影手动采样，自由度比 envMap 更高。
        vec3 R = reflect(-V, N);
        vec2 euv = vec2(atan(R.z, R.x) * 0.15915494 + 0.5, asin(clamp(R.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 envCol = texture2D(uEnv, vec2(euv.x, 1.0 - euv.y)).rgb;
        float refl = pow(1.0 - facing, 1.35);
        col += envCol * (0.10 + refl * 1.35) * uEnvIntensity;

        // 极轻的暗角，让球体压住画面重心
        col *= mix(0.55, 1.0, body);

        // 厚度感即透明度：中心最薄最透，边缘最厚接近实心
        float alpha = mix(0.94, 0.55, smoothstep(0.08, 0.96, facing));
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}