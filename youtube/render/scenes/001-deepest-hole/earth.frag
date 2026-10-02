#version 300 es
// 001화 배경 셰이더 — 암석 지층, 지열, 흘러드는 암벽, 구멍 속 터널
precision highp float;
out vec4 o;
uniform vec2  uRes;
uniform float uT;        // 초
uniform float uStrata;   // 지층 배경 세기 0~1
uniform float uDescent;  // 하강량 (화면 높이 단위)
uniform float uHeat;     // 지열 0~1
uniform float uWall;     // 단면 암벽 0~1
uniform float uBulge;    // 암벽이 안으로 흘러든 폭 (px, 1080 기준)
uniform float uTunnel;   // 구멍 속 터널 0~1
uniform float uTunnelR;  // 터널 반지름 (px)

const vec3 BG = vec3(11., 13., 16.) / 255.;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= .5; } return v; }

// 지층: 깊이 따라 색이 데워진다. 밝기를 낮게 묶어 위에 올라가는 숫자·자막이 읽히게 한다
vec3 strata(vec2 px, float heat){
  float y = px.y / 1920. + uDescent + uT * .004;
  vec2 q = vec2(px.x / 1080. * 2.2, y * 5.);
  float warp = fbm(q * vec2(1., .5) + vec2(uT * .015, 0.));
  float band = fbm(vec2(y * 11. + warp * 1.8, px.x / 1080. * .7));
  vec3 a = vec3(.060, .070, .085), b = vec3(.165, .145, .125), c = vec3(.250, .155, .095);
  vec3 col = mix(a, b, smoothstep(.30, .72, band));
  col = mix(col, c, smoothstep(.60, .88, band) * (.40 + .60 * heat));
  // 층과 층 사이의 어두운 결 — 이게 있어야 '지층'으로 읽힌다
  float seam = abs(fract(y * 7. + warp * 1.2) - .5);
  col *= .62 + .38 * smoothstep(.0, .09, seam);
  col *= .78 + .40 * fbm(q * 7.);
  // 지열: 아래쪽에서 올라오는 붉은 기운, 느리게 일렁인다
  float lower = smoothstep(.25, 1., px.y / 1920.);
  float flick = fbm(q * 2.5 + vec2(0., -uT * .35));
  col += vec3(.55, .16, .05) * heat * lower * pow(flick, 2.2) * .9;
  return col;
}

// 단면 암벽: 가운데 틈이 구멍. 벽이 종 모양으로 안으로 흘러든다
vec3 wall(vec2 px, out float inside){
  const float TOP = 560., BOT = 1290., CX = 540., GAP = 100., OUTER = 300.;
  float mid = (TOP + BOT) * .5;
  float d = abs(px.x - CX);
  float bump = exp(-pow((px.y - mid) / 210., 2.));
  float edge = GAP - uBulge * bump;                      // 안쪽 벽면
  float vfade = smoothstep(TOP, TOP + 40., px.y) * (1. - smoothstep(BOT - 40., BOT, px.y));
  float hfade = 1. - smoothstep(GAP + OUTER - 90., GAP + OUTER, d);   // 바깥쪽은 어둠 속으로 사라진다
  inside = step(edge, d) * hfade * vfade;
  // 녹은 암석: 아래로 흐르며 비틀린다
  vec2 q = vec2(px.x / 70., px.y / 70. - uT * .55);
  float m = fbm(q + 1.5 * vec2(fbm(q * .7 + uT * .12), fbm(q * .7 + 3.1)));
  vec3 rock = mix(vec3(.08, .07, .07), vec3(.22, .12, .08), m);
  float glow = exp(-(d - edge) / 55.) * (.55 + .9 * m);  // 뚫린 쪽 벽면이 가장 뜨겁다
  vec3 lava = vec3(1., .36, .12) * glow * (.6 + .6 * uHeat);
  return rock + lava;
}

// 23cm 구멍을 위에서 내려다본다: 끝없이 이어지는 좁은 관, 바닥은 붉게 달아 있다
vec3 tunnel(vec2 px, float R, out float inside){
  vec2 c = vec2(540., 970.);
  vec2 v = px - c;
  float r = length(v);
  inside = step(r, R);
  float a = atan(v.y, v.x) / 3.14159;
  float depth = 60. / (r / max(R, 1.) + .06);            // 가운데로 갈수록 깊다
  float tex = fbm(vec2(a * 4., depth * .06 + uT * .9));
  float rings = .5 + .5 * sin(depth * .9 - uT * 6.);
  vec3 col = mix(vec3(.05, .05, .06), vec3(.16, .13, .11), tex) * (.7 + .3 * rings);
  col *= pow(r / max(R, 1.), .7);                        // 원근: 중심은 어둡게 멀어진다
  col += vec3(.9, .28, .08) * exp(-r / (R * .09)) * .9; // 12km 아래 바닥의 180°C
  return col;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1080. / uRes.x);
  vec3 col = BG;
  col = mix(col, strata(px, uHeat), uStrata);

  float inW; vec3 w = wall(px, inW);
  col = mix(col, w, inW * uWall);
  // 벽 사이 틈(구멍)은 더 깊은 어둠
  if (uWall > 0.) {
    float d = abs(px.x - 540.); float mid = 925.;
    float bump = exp(-pow((px.y - mid) / 210., 2.));
    float gap = step(d, 100. - uBulge * bump) * step(560., px.y) * step(px.y, 1290.);
    col = mix(col, vec3(.01), gap * uWall * .8);
  }

  float inT; vec3 tn = tunnel(px, uTunnelR, inT);
  col = mix(col, tn, inT * uTunnel);

  o = vec4(col, 1.);
}
