/* LA SALA ARONYX — EN VIVO (remodelación 2026-10-26): alimenta la Sala 3D y
   la escena Viva, la PARED DE MERCADO (divisas/oro de contexto + acciones),
   el panel EN VIVO, el ciclo diario y la vista «la sala trabajando» desde
   datos_web/en_vivo.json (en_vivo/correr_en_vivo.py + en_vivo/vigia_en_vivo.py).
   Refresco ~60 s. Los estados de la escena se alimentan del EN VIVO: agente
   con posición abierta -> "abierta"; ALGIZ muestra el drawdown en vivo.
   Las divisas de intradia.mercado son SOLO contexto: no se operan. */
"use strict";
(function () {
  var fmt = function (n) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtFx = function (n) {
    if (n === null || n === undefined) return "—";
    var a = Math.abs(n);
    if (a >= 100) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (a >= 10) return n.toFixed(3);
    if (a >= 1) return n.toFixed(4);
    return n.toFixed(5);
  };
  var col = function (n) { return n < 0 ? "#e5534b" : "#3fb950"; };
  var AGENTES = ["ANSUZ", "THURISAZ", "SOWILO", "EHWAZ"];

  function estadoMercadoDe(iv) {
    if (!iv) return null;
    if (iv.estado_mercado) return iv.estado_mercado;
    if (iv.mercado && !Array.isArray(iv.mercado)) return iv.mercado; // JSON anterior a la remodelación
    return null;
  }

  function estadosSala(d) {
    var mapa = {};
    AGENTES.forEach(function (a) { mapa[a] = { estado: "inactivo" }; });
    var dd = typeof d["drawdown_actual_%"] === "number" ? d["drawdown_actual_%"] : 0;
    mapa.ALGIZ = { dd: dd / 100, paradaTotal: !!d.parada_total };
    var pos = (d.intradia && d.intradia.posiciones_en_vivo && d.intradia.posiciones_en_vivo.length)
      ? d.intradia.posiciones_en_vivo : (d.posiciones_abiertas || []);
    pos.forEach(function (p) { if (mapa[p.agente]) mapa[p.agente] = { estado: "abierta" }; });
    if (window.SalaViva && SalaViva.setEstados) { try { SalaViva.setEstados(mapa); } catch (e) { /* capa visual: nunca rompe la página */ } }
    if (window.Sala3D && Sala3D.setEstados) { try { Sala3D.setEstados(mapa); } catch (e) { /* capa visual: nunca rompe la página */ } }
  }

  function pintarPanel(d) {
    document.getElementById("ev-equity").textContent = fmt(d.equity);
    var pnl = document.getElementById("ev-pnl");
    pnl.textContent = fmt(d.pnl_acumulado_$) + " (" + (d["pnl_acumulado_%"] >= 0 ? "+" : "") + d["pnl_acumulado_%"] + " %)";
    pnl.style.color = d.pnl_acumulado_$ < 0 ? "#e5534b" : "#3fb950";
    document.getElementById("ev-cash").textContent = fmt(d.cash);
    document.getElementById("ev-sesion").textContent = d.ultima_sesion_procesada || "—";
    document.getElementById("ev-actualizado").textContent = "Actualizado: " + (d.actualizado || "").replace("T", " ") + " · DD máx " + d["drawdown_max_%"] + " % · cerradas: " + d.operaciones_cerradas + (d.parada_total ? " · ⛔ PARADA TOTAL" : "");
    var pos = document.getElementById("ev-posiciones");
    if (!d.posiciones_abiertas.length) { pos.innerHTML = '<p class="tenue">Sin posiciones abiertas.</p>'; }
    else {
      pos.innerHTML = d.posiciones_abiertas.map(function (p) {
        return '<div class="tarjeta-panel"><span class="etq">' + p.agente + " · " + p.estrategia + '</span><strong>' + p.simbolo + "</strong> " +
          p.acciones + " acc @ " + fmt(p.entrada) + " · stop " + fmt(p.stop) + (p.objetivo ? " · objetivo " + fmt(p.objetivo) : "") +
          (p.pnl_abierto_$ !== null ? ' · P&amp;L abierto <span style="color:' + (p.pnl_abierto_$ < 0 ? "#e5534b" : "#3fb950") + '">' + fmt(p.pnl_abierto_$) + "</span>" : "") +
          '<span class="etq">desde ' + p.fecha_entrada + "</span></div>";
      }).join("");
    }
    var pen = document.getElementById("ev-pendientes");
    if (!d.senales_pendientes.length) { pen.innerHTML = '<p class="tenue">Sin señales pendientes: ALGIZ no ha aprobado ninguna entrada para la próxima apertura.</p>'; }
    else {
      pen.innerHTML = d.senales_pendientes.map(function (p) {
        if (p.tipo === "salida") return '<div class="tarjeta-panel"><span class="etq">SALIDA · ' + p.agente + '</span><strong>' + p.simbolo + "</strong> " + p.motivo + '<span class="etq">' + p.ejecucion + "</span></div>";
        return '<div class="tarjeta-panel"><span class="etq">' + p.agente + " · " + p.estrategia + '</span><strong>' + p.simbolo + "</strong> stop " + fmt(p.stop) + (p.objetivo ? " · objetivo " + fmt(p.objetivo) : " · sin objetivo fijo") + '<span class="etq">señal del ' + p.fecha_senal + " · " + p.ejecucion + "</span></div>";
      }).join("");
    }
    pintarCiclo(d);
  }

  function pintarCiclo(d) {
    var el = document.getElementById("ciclo-datos");
    if (!el) return;
    var c = d.contadores || {};
    el.innerHTML = "El ciclo hasta hoy: <strong>" + (c.sesiones_procesadas || 0) + "</strong> sesiones procesadas · <strong>" +
      (c.senales_detectadas || 0) + "</strong> señales detectadas · <strong>" + (d.senales_rechazadas_algiz || 0) +
      "</strong> rechazadas por ALGIZ · <strong>" + (c.entradas_ejecutadas || 0) + "</strong> entradas ejecutadas solas en la demo.";
  }

  function pintarPared(d) {
    var el = document.getElementById("pared-divisas");
    if (!el) return;
    var iv = d.intradia;
    var lista = iv && Array.isArray(iv.mercado) ? iv.mercado : null;
    if (!lista || !lista.length) {
      el.innerHTML = '<p class="tenue">La pared de divisas llega con el próximo sondeo del vigía.</p>';
      return;
    }
    el.innerHTML = lista.map(function (p) {
      var hora = p.hora_precio ? String(p.hora_precio).slice(11, 16) + " ET" : "";
      return '<div class="lv-precio fx"><span class="sim">' + p.nombre + '</span><span class="pr">' +
        (p.precio !== null && p.precio !== undefined ? fmtFx(p.precio) : "—") + '</span><span class="cb" style="color:' +
        (p["cambio_dia_%"] === null || p["cambio_dia_%"] === undefined ? "#9a917e" : col(p["cambio_dia_%"])) + '">' +
        (p["cambio_dia_%"] !== null && p["cambio_dia_%"] !== undefined ? (p["cambio_dia_%"] >= 0 ? "+" : "") + p["cambio_dia_%"] + " % hoy" : "sin datos") +
        "</span>" + (hora ? '<span class="hora">' + hora + (p.reutilizado ? " · último conocido" : "") + "</span>" : "") + "</div>";
    }).join("");
  }

  function pintarVivo(d) {
    var iv = d.intradia;
    if (!iv) { document.getElementById("lv-mercado").textContent = "Capa intradía aún sin datos (el vigía no ha corrido)."; return; }
    var em = estadoMercadoDe(iv);
    if (em) {
      document.getElementById("lv-mercado").textContent = (em.estado === "abierto" ? "🟢 MERCADO ABIERTO" : "🔴 MERCADO CERRADO") + " · " + em.nota + " · " + (em.hora_et || "").replace("T", " ") + ".";
    }
    document.getElementById("lv-equity").textContent = fmt(iv.equity_flotante);
    var pnl = document.getElementById("lv-pnl");
    pnl.textContent = fmt(iv.pnl_flotante_total_$); pnl.style.color = col(iv.pnl_flotante_total_$);
    document.getElementById("lv-npos").textContent = iv.posiciones_en_vivo.length;
    document.getElementById("lv-precios").innerHTML = iv.precios.map(function (p) {
      return '<div class="lv-precio"><span class="sim">' + p.simbolo + '</span><span class="pr">' + (p.precio !== null ? fmt(p.precio) : "—") + '</span><span class="cb" style="color:' + col(p["cambio_dia_%"]) + '">' + (p["cambio_dia_%"] !== null ? (p["cambio_dia_%"] >= 0 ? "+" : "") + p["cambio_dia_%"] + " % hoy" : "sin datos") + "</span></div>";
    }).join("");
    var pos = document.getElementById("lv-posiciones");
    pos.innerHTML = iv.posiciones_en_vivo.length ? iv.posiciones_en_vivo.map(function (p) {
      return '<div class="tarjeta-panel"><span class="etq">' + p.agente + " · " + p.estrategia + '</span><strong>' + p.simbolo + "</strong> " + p.acciones + " acc @ " + fmt(p.entrada) +
        " → ahora " + fmt(p.precio_actual) + ' · <span style="color:' + col(p.pnl_en_vivo_$) + '">' + fmt(p.pnl_en_vivo_$) + " (" + (p["pnl_en_vivo_%"] >= 0 ? "+" : "") + p["pnl_en_vivo_%"] + " %)</span>" +
        '<span class="etq">stop ' + fmt(p.stop) + (p.objetivo ? " · objetivo " + fmt(p.objetivo) : "") + " · desde " + p.fecha_entrada + "</span></div>";
    }).join("") : '<p class="tenue">Sin posiciones demo abiertas: la sala estudia y espera su disparador.</p>';
    document.getElementById("lv-estudio").innerHTML = iv.estudio_agentes.map(function (e) {
      return '<div class="tarjeta-panel"><span class="etq">' + e.agente + " · " + e.estrategia + '</span><strong>Vigila: ' + e.vigila + "</strong><br>Espera: " + e.espera +
        (e["distancia_%"] !== null && e.agente !== "ALGIZ" ? '<br><span style="color:#d4af37">Distancia al disparador: ' + (e["distancia_%"] >= 0 ? "+" : "") + e["distancia_%"] + " %</span>" : "") +
        '<span class="etq">' + e.detalle + "</span></div>";
    }).join("");
    document.getElementById("lv-feed").innerHTML = iv.feed_actividad.map(function (f) {
      return '<li><span class="fh">' + f.hora + "</span>" + f.texto + "</li>";
    }).join("");
  }

  var primerFallo = true;
  function cargar() {
    fetch("datos_web/en_vivo.json").then(function (r) { return r.json(); }).then(function (d) {
      pintarPanel(d);
      pintarVivo(d);
      pintarPared(d);
      estadosSala(d);
    }).catch(function () {
      if (primerFallo) {
        primerFallo = false;
        document.getElementById("ev-posiciones").innerHTML = '<p class="tenue">Datos en vivo aún no disponibles.</p>';
      }
    });
  }
  cargar();
  setInterval(cargar, 60000);

  /* ---------- vistas de la sala: 3D (escenario principal) / Imagen viva ----------
     La 3D manda; si WebGL no está, el botón se desactiva y queda la imagen. */
  var vistaActual = "viva";
  var canvas3d = document.getElementById("sala3d");
  var btn3d = document.getElementById("btn-vista-3d");
  var btnViva = document.getElementById("btn-vista-viva");
  function fijarVista(v) {
    vistaActual = v;
    var es3d = v === "3d";
    document.getElementById("wrap-3d").hidden = !es3d;
    document.getElementById("wrap-viva").hidden = es3d;
    btn3d.classList.toggle("activo", es3d);
    btnViva.classList.toggle("activo", !es3d);
    if (window.Sala3D && Sala3D.setVisible) Sala3D.setVisible(es3d);
    if (window.SalaViva && SalaViva.setVisible) SalaViva.setVisible(!es3d);
    if (es3d && window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
    if (!es3d && window.SalaViva && SalaViva.redimensionar) SalaViva.redimensionar();
  }
  var ok3d = false;
  if (window.Sala3D && Sala3D.iniciar && canvas3d) {
    try { ok3d = !!Sala3D.iniciar(canvas3d); } catch (e) { ok3d = false; }
  }
  if (!ok3d && btn3d) { btn3d.disabled = true; btn3d.title = "WebGL no disponible en este navegador"; }
  if (btn3d) btn3d.addEventListener("click", function () { fijarVista("3d"); });
  if (btnViva) btnViva.addEventListener("click", function () { fijarVista("viva"); });
  fijarVista(ok3d ? "3d" : "viva");
  // pausa de la 3D cuando sale de pantalla (ahorro en el móvil)
  if (window.IntersectionObserver && canvas3d) {
    new IntersectionObserver(function (entradas) {
      if (window.Sala3D && Sala3D.setVisible) {
        Sala3D.setVisible(vistaActual === "3d" && entradas[0].isIntersecting);
      }
    }, { threshold: 0.05 }).observe(canvas3d);
  }
  window.addEventListener("resize", function () {
    if (window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
    if (window.SalaViva && SalaViva.redimensionar) SalaViva.redimensionar();
  });
})();
