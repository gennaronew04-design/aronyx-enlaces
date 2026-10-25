/* LA SALA ARONYX — vista 3D (Three.js r128 vendorizado, sin CDN).
   Escena estilizada low-poly construida con primitivas: suelo de obsidiana,
   medallón central con la textura REAL del sigilo oficial (desde el
   <img id="sigilo-src"> del DOM, para que funcione igual con el archivo
   local o con la data URI de GitHub Pages), anillo de runas doradas,
   5 puestos en semicírculo con figura encapuchada, monitores con
   mini-gráficas y luces de estado con la misma semántica que la vista 2D.
   API pública: window.Sala3D = { iniciar(canvas), setEstados(mapa),
   setVisible(bool), redimensionar() }. */
"use strict";
window.Sala3D = (function () {
  var COLORES = {
    inactivo: 0x6b6350, abierta: 0x2dd4bf, gano: 0x34d399,
    perdio: 0xf87171, pausado: 0xd4af37
  };
  var NOMBRES = ["ANSUZ", "THURISAZ", "SOWILO", "EHWAZ", "ALGIZ"];
  var RUNAS = { ANSUZ: "ᚨ", THURISAZ: "ᚦ", SOWILO: "ᛋ", EHWAZ: "ᛖ", ALGIZ: "ᛉ" };
  // semicírculo en el lado lejano (-Z), mirando al medallón
  var ANGULOS = { ANSUZ: -0.95, THURISAZ: -0.47, SOWILO: 0.47, EHWAZ: 0.95, ALGIZ: 0 };
  var RADIO = 8.4;

  var iniciado = false, renderer = null, scene = null, camera = null, canvasEl = null;
  var luces = {};              // nombre -> material de la esfera de estado
  var placaAlgiz = null;       // {canvas, ctx, tex, ultimo}
  var haloAlgiz = null, luzParada = null;
  var visible = true, rafId = null, reloj = null;
  var pendientes = null;       // último mapa de estados recibido antes de iniciar
  // órbita propia (sin OrbitControls)
  var azUsuario = 0, polarUsuario = 0.98, radioUsuario = 16.5;
  var punteros = {}, distanciaPinch = 0;

  function texturaSigilo() {
    var img = document.getElementById("sigilo-src");
    if (!img) return null;
    var tex = new THREE.Texture(img);
    tex.encoding = THREE.sRGBEncoding;
    if (img.complete && img.naturalWidth > 0) tex.needsUpdate = true;
    else img.addEventListener("load", function () { tex.needsUpdate = true; });
    return tex;
  }

  function canvasRedondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function texturaPlaca(texto, borde) {
    var c = document.createElement("canvas"); c.width = 512; c.height = 128;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(2,3,4,0.88)"; canvasRedondeado(ctx, 6, 14, 500, 100, 18); ctx.fill();
    ctx.strokeStyle = borde || "#d4af37"; ctx.lineWidth = 5; canvasRedondeado(ctx, 6, 14, 500, 100, 18); ctx.stroke();
    ctx.fillStyle = "#e8c766"; ctx.font = "700 54px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(texto, 256, 66);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function dibujarPlacaAlgiz(texto, parada) {
    if (!placaAlgiz) return;
    if (placaAlgiz.ultimo === texto + "|" + parada) return;
    placaAlgiz.ultimo = texto + "|" + parada;
    var ctx = placaAlgiz.ctx;
    ctx.clearRect(0, 0, 640, 128);
    ctx.fillStyle = "rgba(2,3,4,0.9)"; canvasRedondeado(ctx, 6, 14, 628, 100, 18); ctx.fill();
    ctx.strokeStyle = parada ? "#f87171" : "#2dd4bf"; ctx.lineWidth = 5;
    canvasRedondeado(ctx, 6, 14, 628, 100, 18); ctx.stroke();
    ctx.fillStyle = parada ? "#f87171" : "#e8c766"; ctx.font = "700 46px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(texto, 320, 66);
    placaAlgiz.tex.needsUpdate = true;
  }

  function texturaGrafica(semilla) {
    var c = document.createElement("canvas"); c.width = 256; c.height = 160;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#04070a"; ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = "rgba(45,212,191,0.14)"; ctx.lineWidth = 1;
    for (var gy = 20; gy < 160; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(256, gy); ctx.stroke(); }
    var rnd = function (s) { var x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
    function serie(color, base, amp, paso) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      var v = base;
      for (var i = 0; i <= 24; i++) {
        v += (rnd(semilla * 31 + i * paso) - 0.44) * amp;
        v = Math.max(18, Math.min(142, v));
        var x = 8 + i * 10, y = 160 - v;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    serie("#2dd4bf", 60 + semilla * 9, 16, 7);
    serie("rgba(212,175,55,0.85)", 44 + semilla * 5, 11, 13);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function texturaAnilloRunas() {
    var c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.fillStyle = "#d4af37"; ctx.font = "700 52px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var runas = "ᚨᚦᛋᛖᛉᚱᚲᚹᚺᚾᛁᛃ";
    var total = 36;
    for (var i = 0; i < total; i++) {
      var a = (i / total) * Math.PI * 2;
      ctx.save();
      ctx.translate(512 + Math.cos(a) * 415, 512 + Math.sin(a) * 415);
      ctx.rotate(a + Math.PI / 2);
      ctx.globalAlpha = 0.92;
      ctx.fillText(runas[i % runas.length], 0, 0);
      ctx.restore();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function crearPuesto(nombre, indice) {
    var g = new THREE.Group();
    var esAlgiz = nombre === "ALGIZ";
    var ang = ANGULOS[nombre];
    var r = esAlgiz ? RADIO + 1.6 : RADIO;
    g.position.set(Math.sin(ang) * r, esAlgiz ? 0.35 : 0, -Math.cos(ang) * r);
    g.lookAt(0, g.position.y, 0); // el +Z local mira al medallón

    var matMesa = new THREE.MeshStandardMaterial({ color: esAlgiz ? 0x12211f : 0x171a21, roughness: 0.6, metalness: 0.3 });
    var matFrente = new THREE.MeshStandardMaterial({ color: 0x0d0f13, roughness: 0.8, metalness: 0.2 });
    var matDorado = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9, emissive: 0x2a1e00 });
    var matNegro = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.55, metalness: 0.25 });

    if (esAlgiz) { // plataforma elevada del vigía
      var plat = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x101613, roughness: 0.7, metalness: 0.3 }));
      plat.position.y = -0.18; g.add(plat);
      var bordePlat = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.4, metalness: 0.7, emissive: 0x06302a }));
      bordePlat.rotation.x = Math.PI / 2; bordePlat.position.y = 0.0; g.add(bordePlat);
    }
    // escritorio: tapa con filete dorado + frente
    var tapa = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 1.25), matMesa); tapa.position.set(0, 0.98, 0); g.add(tapa);
    var filete = new THREE.Mesh(new THREE.BoxGeometry(3.36, 0.05, 1.31), matDorado); filete.position.set(0, 0.925, 0); g.add(filete);
    var frente = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.92, 0.1), matFrente); frente.position.set(0, 0.48, 0.58); g.add(frente);
    // figura encapuchada detrás del escritorio
    var cono = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.95, 24), matNegro); cono.position.set(0, 0.98, -0.95); g.add(cono);
    var cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })); cabeza.position.set(0, 1.78, -0.95); g.add(cabeza);
    var ribete = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 8, 32), matDorado); ribete.rotation.x = Math.PI / 2; ribete.position.set(0, 1.42, -0.95); g.add(ribete);
    // monitores con mini-gráfica
    [-0.85, 0.85].forEach(function (mx, k) {
      var mon = new THREE.Group();
      var pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0x04070a, roughness: 0.4, metalness: 0.4 }));
      mon.add(pantalla);
      var graf = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.62), new THREE.MeshBasicMaterial({ map: texturaGrafica(indice * 2 + k + 1) }));
      graf.position.z = -0.036; graf.rotation.y = Math.PI; // la cara mira a la figura (-Z local)
      mon.add(graf);
      var pie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), matFrente); pie.position.y = -0.48; mon.add(pie);
      mon.position.set(mx, 1.5, -0.15); mon.rotation.y = (k === 0 ? 0.22 : -0.22);
      g.add(mon);
    });
    // placa con nombre (sprite: siempre legible)
    var placa;
    if (esAlgiz) {
      var c = document.createElement("canvas"); c.width = 640; c.height = 128;
      placaAlgiz = { canvas: c, ctx: c.getContext("2d"), tex: new THREE.CanvasTexture(c), ultimo: "" };
      placaAlgiz.tex.encoding = THREE.sRGBEncoding;
      dibujarPlacaAlgiz("ALGIZ ᛉ · DD 0,00 %", false);
      placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: placaAlgiz.tex, transparent: true }));
      placa.scale.set(3.6, 0.72, 1);
    } else {
      placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaPlaca(nombre + " " + RUNAS[nombre]), transparent: true }));
      placa.scale.set(2.7, 0.68, 1);
    }
    placa.position.set(0, 0.5, 1.05); g.add(placa);
    // luz de estado sobre un mástil
    var mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), matFrente); mastil.position.set(1.45, 1.55, 0.2); g.add(mastil);
    var matLuz = new THREE.MeshBasicMaterial({ color: COLORES.inactivo });
    var esfera = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), matLuz); esfera.position.set(1.45, 2.2, 0.2); g.add(esfera);
    luces[nombre] = matLuz;
    if (esAlgiz) {
      haloAlgiz = new THREE.Mesh(new THREE.RingGeometry(2.65, 2.95, 48),
        new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      haloAlgiz.rotation.x = -Math.PI / 2; haloAlgiz.position.y = 0.06; haloAlgiz.visible = false; g.add(haloAlgiz);
      luzParada = new THREE.PointLight(0xf87171, 0, 11); luzParada.position.set(0, 2.4, 0); g.add(luzParada);
    }
    return g;
  }

  function construirEscena() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080a);
    scene.fog = new THREE.Fog(0x07080a, 20, 44);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

    scene.add(new THREE.AmbientLight(0x8a8272, 0.55));
    var dir = new THREE.DirectionalLight(0xffe0b3, 0.85); dir.position.set(7, 13, 5); scene.add(dir);
    var centro = new THREE.PointLight(0xd4af37, 0.85, 15); centro.position.set(0, 3.2, 0); scene.add(centro);
    var teal = new THREE.PointLight(0x2dd4bf, 0.35, 20); teal.position.set(0, 1.2, -9); scene.add(teal);

    var suelo = new THREE.Mesh(new THREE.CircleGeometry(19, 48),
      new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.32, metalness: 0.65 }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.02; scene.add(suelo);

    // medallón central con el sigilo oficial
    var texSig = texturaSigilo();
    var matMedallon = texSig
      ? new THREE.MeshStandardMaterial({ map: texSig, roughness: 0.42, metalness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    var medallon = new THREE.Mesh(new THREE.CircleGeometry(3.15, 48), matMedallon);
    medallon.rotation.x = -Math.PI / 2; medallon.position.y = 0.01; scene.add(medallon);
    var aro = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.055, 10, 72),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.28, metalness: 0.95, emissive: 0x33240a }));
    aro.rotation.x = Math.PI / 2; aro.position.y = 0.03; scene.add(aro);
    var anillo = new THREE.Mesh(new THREE.RingGeometry(3.62, 4.72, 64),
      new THREE.MeshBasicMaterial({ map: texturaAnilloRunas(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.015; scene.add(anillo);

    NOMBRES.forEach(function (n, i) { scene.add(crearPuesto(n, i)); });
  }

  function aplicarEstados(mapa) {
    if (!mapa) return;
    pendientes = mapa;
    if (!iniciado) return;
    NOMBRES.forEach(function (n) {
      var info = mapa[n]; if (!info || !luces[n]) return;
      if (n === "ALGIZ") {
        var parada = !!info.paradaTotal;
        luces[n].color.setHex(parada ? 0xf87171 : 0x2dd4bf);
        var ddTxt = (typeof info.dd === "number")
          ? " · DD " + (info.dd * 100).toFixed(2).replace(".", ",") + " %" : "";
        dibujarPlacaAlgiz(parada ? "⛔ ALGIZ ᛉ · PARADA TOTAL" : "ALGIZ ᛉ" + ddTxt, parada);
        if (haloAlgiz) haloAlgiz.visible = parada;
        if (luzParada) luzParada.intensity = parada ? 1.3 : 0;
      } else if (info.estado && COLORES[info.estado] !== undefined) {
        luces[n].color.setHex(COLORES[info.estado]);
      }
    });
  }

  function redimensionar() {
    if (!iniciado || !renderer || !canvasEl) return;
    var w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function bucle() {
    rafId = requestAnimationFrame(bucle);
    if (!visible || document.hidden) return;
    var t = reloj.getElapsedTime();
    var az = azUsuario + Math.sin(t * 0.11) * 0.14; // deriva lenta ±8°
    var polar = polarUsuario, r = radioUsuario;
    var objetivo = new THREE.Vector3(
      Math.sin(az) * Math.sin(polar) * r,
      Math.cos(polar) * r + 0.6,
      Math.cos(az) * Math.sin(polar) * r - 1.2
    );
    camera.position.lerp(objetivo, 0.07);
    camera.lookAt(0, 0.7, -1.2);
    renderer.render(scene, camera);
  }

  function registrarPunteros() {
    canvasEl.style.touchAction = "none";
    canvasEl.addEventListener("pointerdown", function (e) {
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(punteros).length === 2) {
        var p = Object.values(punteros);
        distanciaPinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
      canvasEl.setPointerCapture(e.pointerId);
    });
    canvasEl.addEventListener("pointermove", function (e) {
      var prev = punteros[e.pointerId]; if (!prev) return;
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(punteros).length === 2) {
        var p = Object.values(punteros);
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (distanciaPinch > 0) radioUsuario = Math.max(10.5, Math.min(24, radioUsuario - (d - distanciaPinch) * 0.03));
        distanciaPinch = d;
      } else {
        azUsuario -= dx * 0.005;
        polarUsuario = Math.max(0.55, Math.min(1.3, polarUsuario + dy * 0.003));
      }
    });
    function soltar(e) { delete punteros[e.pointerId]; distanciaPinch = 0; }
    canvasEl.addEventListener("pointerup", soltar);
    canvasEl.addEventListener("pointercancel", soltar);
    canvasEl.addEventListener("wheel", function (e) {
      e.preventDefault();
      radioUsuario = Math.max(10.5, Math.min(24, radioUsuario + e.deltaY * 0.01));
    }, { passive: false });
  }

  return {
    iniciar: function (canvas) {
      if (iniciado) return true;
      if (!window.THREE || !canvas) return false;
      canvasEl = canvas;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        if (!renderer || !renderer.getContext()) return false;
      } catch (e) { return false; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      construirEscena();
      iniciado = true;
      reloj = new THREE.Clock();
      camera.position.set(10, 9, 12);
      registrarPunteros();
      redimensionar();
      if (pendientes) aplicarEstados(pendientes);
      bucle();
      return true;
    },
    setEstados: function (mapa) { aplicarEstados(mapa); },
    setVisible: function (v) { visible = !!v; if (visible) redimensionar(); },
    redimensionar: function () { redimensionar(); }
  };
})();
