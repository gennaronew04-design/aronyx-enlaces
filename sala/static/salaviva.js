/* LA SALA ARONYX — vista Viva: la imagen cinematográfica de la sala como
   escena principal que REACCIONA al EN VIVO. Capas de luz por agente con la
   misma semántica que las vistas 2D/3D (el mapa llega desde vivo.js, ya
   calculado: no se duplica ninguna lógica), pulso de lava sobre el
   medallón, lámparas y braseros con parpadeo CSS, brasas ascendentes en
   canvas y parallax suave por capas.
   API pública: window.SalaViva = { setEstados(mapa), setVisible(bool),
   redimensionar(), setParallax(dx, dy) }.
   La capa .viva-parallax comparte el aspecto exacto de la imagen (3:2):
   los halos se posicionan en % de la imagen y quedan pegados a su
   encapuchado con cualquier recorte del contenedor (16/9 o 5/4 en
   presentación, donde el foco vertical cae sobre el medallón). */
"use strict";
window.SalaViva = (function () {
  var ESTADOS = { inactivo: 1, abierta: 1, gano: 1, perdio: 1, pausado: 1 };
  var cont = null, capa = null, canvas = null, ctx = null, placaAlgiz = null;
  var halos = {};            // nombre -> elemento .viva-halo
  var iniciado = false, visible = false, pendientes = null;
  var reducido = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // parallax: destino (tx, ty) y posición actual (cx, cy), en px, ±6
  var tx = 0, ty = 0, cx = 0, cy = 0;
  // brasas
  var particulas = [], W = 0, H = 0, N_BRASAS = 46;

  function esPres() { return document.body.classList.contains("presentacion"); }

  function aplicarTransform() {
    if (!capa) return;
    var s = reducido ? 1.02 : 1.05;
    if (esPres()) {
      // capa anclada al 50 %/50 % del contenedor; se desplaza -57 % de su
      // propia altura para que el medallón (57 % de la imagen) quede al centro
      capa.style.transform = "translate(calc(-50% + " + cx.toFixed(1) + "px), calc(-57% + " + cy.toFixed(1) + "px)) scale(" + s + ")";
    } else {
      // capa anclada con top:50 % -> se centra con translateY(-50 %)
      capa.style.transform = "translate(" + cx.toFixed(1) + "px, calc(-50% + " + cy.toFixed(1) + "px)) scale(" + s + ")";
    }
  }

  /* ---------- estados (mismo mapa que recibe Sala3D) ---------- */
  function aplicarEstados(mapa) {
    if (!mapa) return;
    pendientes = mapa;
    if (!iniciado) return;
    for (var nombre in halos) {
      var info = mapa[nombre]; if (!info) continue;
      var raiz = halos[nombre];
      if (nombre === "ALGIZ") {
        var parada = !!info.paradaTotal;
        raiz.classList.toggle("parada", parada);
        cont.classList.toggle("parada", parada);
        if (placaAlgiz) {
          var txt = parada
            ? "⛔ ALGIZ ᛉ · PARADA TOTAL"
            : "ALGIZ ᛉ · DD " + (typeof info.dd === "number"
                ? (info.dd * 100).toFixed(2).replace(".", ",") : "0,00") + " %";
          if (placaAlgiz.textContent !== txt) placaAlgiz.textContent = txt;
        }
      } else {
        var est = info.estado && ESTADOS[info.estado] ? info.estado : "inactivo";
        if (raiz.dataset.estado !== est) raiz.dataset.estado = est;
      }
    }
  }

  /* ---------- brasas ascendentes ---------- */
  function nuevaParticula(p, repartida) {
    p.x = Math.random() * (W || 300);
    p.y = repartida ? Math.random() * (H || 200)
                    : (H || 200) + 6 + Math.random() * (H || 200) * 0.2;
    p.vy = 0.22 + Math.random() * 0.55;          // px por frame (~60 fps)
    p.fase = Math.random() * Math.PI * 2;
    p.r = 0.8 + Math.random() * 1.9;
    p.vida = repartida ? Math.random() * 200 : 0;
    p.max = 260 + Math.random() * 240;
    p.tono = Math.random() < 0.72 ? "255,166,66" : "255,110,40";
    return p;
  }
  function dibujarBrasas(ts) {
    if (!ctx || !W || !H) return;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particulas.length; i++) {
      var p = particulas[i];
      p.vida++;
      p.y -= p.vy;
      p.x += Math.sin(ts * 0.0016 + p.fase) * 0.18;
      if (p.vida > p.max || p.y < -8) { nuevaParticula(p, false); continue; }
      var a = Math.sin(Math.PI * Math.min(p.vida / p.max, 1)) * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = "rgba(" + p.tono + "," + a.toFixed(3) + ")";
      ctx.fill();
    }
  }

  /* ---------- bucle (parallax + brasas) ---------- */
  function bucle(ts) {
    requestAnimationFrame(bucle);
    if (!visible || document.hidden || !iniciado) return;
    if (!reducido) {
      // deriva automática muy lenta + destino del puntero, con lerp suave
      var dx = tx + Math.sin(ts * 0.00021) * 2.2;
      var dy = ty + Math.cos(ts * 0.00016) * 1.4;
      cx += (dx - cx) * 0.045;
      cy += (dy - cy) * 0.045;
      aplicarTransform();
      dibujarBrasas(ts);
    }
  }

  function registrarPunteros() {
    cont.addEventListener("pointermove", function (e) {
      if (reducido) return;
      var r = cont.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = ((e.clientX - r.left) / r.width - 0.5) * 12;   // ±6 px
      ty = ((e.clientY - r.top) / r.height - 0.5) * 12;
    });
    cont.addEventListener("pointerleave", function () { tx = 0; ty = 0; });
  }

  function redimensionar() {
    if (!iniciado || !canvas || !cont) return;
    var w = cont.clientWidth, h = cont.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h;
    if (!particulas.length) {
      for (var i = 0; i < N_BRASAS; i++) particulas.push(nuevaParticula({}, true));
    }
    aplicarTransform();
  }

  function iniciar() {
    cont = document.getElementById("sala-viva");
    if (!cont) return false;
    capa = document.getElementById("viva-parallax");
    canvas = document.getElementById("viva-brasas");
    placaAlgiz = document.getElementById("viva-placa-algiz");
    if (!capa || !canvas) return false;
    ctx = canvas.getContext("2d");
    if (!ctx) return false;
    document.querySelectorAll(".viva-halo").forEach(function (h) { halos[h.dataset.agente] = h; });
    iniciado = true;
    registrarPunteros();
    redimensionar();
    if (pendientes) aplicarEstados(pendientes);
    requestAnimationFrame(bucle);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && visible) redimensionar();
    });
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  return {
    setEstados: function (mapa) { aplicarEstados(mapa); },
    setVisible: function (v) {
      visible = !!v;
      if (visible) { redimensionar(); }
      else if (ctx && W && H) ctx.clearRect(0, 0, W, H);
    },
    redimensionar: function () { redimensionar(); },
    setParallax: function (dx, dy) {
      tx = Math.max(-6, Math.min(6, Number(dx) || 0));
      ty = Math.max(-6, Math.min(6, Number(dy) || 0));
    }
  };
})();
