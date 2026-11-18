/* 셰이더 배경 레이어 — "움직이는 그림"을 코드로 만든다.

   AI 영상 생성 없이도 암석·용암·터널 같은 살아 있는 질감을 낼 수 있다.
   헤드리스 Chromium의 WebGL2(SwiftShader, CPU)로 그리므로 GPU가 필요 없다.
   결정론은 그대로다: 셰이더 입력은 시간 t와 씬이 넘기는 값뿐이라, 같은 t는 같은 픽셀이다.

   성능: CPU로 그리므로 내부 해상도를 절반(540×960)으로 두고 CSS로 키운다.
   질감이 부드러운 그림이라 해상도 손실이 눈에 띄지 않는다. */

export function createShaderLayer(canvas, fragSrc, { scale = 0.5 } = {}) {
  canvas.width = Math.round(1080 * scale);
  canvas.height = Math.round(1920 * scale);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2를 쓸 수 없습니다');

  const vs = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);  // 화면 덮는 삼각형 하나
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const locs = {};
  const u = name => (name in locs ? locs[name] : (locs[name] = gl.getUniformLocation(prog, name)));
  return {
    draw(uniforms) {
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      for (const [k, v] of Object.entries(uniforms)) {
        const l = u(k); if (l === null) continue;
        Array.isArray(v) ? gl[`uniform${v.length}f`](l, ...v) : gl.uniform1f(l, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();   // 캡처가 그리기 완료 후에 찍히도록
    },
  };
}
