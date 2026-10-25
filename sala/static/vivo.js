/* LA SALA ARONYX — EN VIVO: alimenta la escena Viva, el panel EN VIVO y la
   vista «la sala trabajando» desde datos_web/en_vivo.json (generado por
   en_vivo/correr_en_vivo.py y en_vivo/vigia_en_vivo.py). Refresco ~60 s.
   Los halos de la escena se alimentan del EN VIVO: agente con posición
   abierta -> estado "abierta"; ALGIZ muestra el drawdown en vivo. */
"use strict";
(function () {
  var fmt = function (n) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var col = function (n) { return n < 0 ? "#e5534b" : "#3fb950"; };
  var AGENTES = ["ANSUZ", "THURISAZ", "SOWILO", "EHWAZ"];

  if (window.SalaViva && SalaViva.setVisible) SalaViva.setVisible(true);

  function estadosViva(d) {
    if (!window.SalaViva || !SalaViva.setEstados) return;
    var mapa = {};
    AGENTES.forEach(function (a) { mapa[a] = { estado: "inactivo" }; });
    var dd = typeof d["drawdown_actual_%"] === "number" ? d["drawdown_actual_%"] : 0;
    mapa.ALGIZ = { dd: dd / 100, paradaTotal: !!d.parada_total };
    var pos = (d.intradia && d.intradia.posiciones_en_vivo && d.intradia.posiciones_en_vivo.length)
      ? d.intradia.posiciones_en_vivo : (d.posiciones_abiertas || []);
    pos.forEach(function (p) { if (mapa[p.agente]) mapa[p.agente] = { estado: "abierta" }; });
    try { SalaViva.setEstados(mapa); } catch (e) { /* la Viva es una capa visual: nunca rompe la página */ }
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
  }

  function pintarVivo(d) {
    var iv = d.intradia;
    if (!iv) { document.getElementById("lv-mercado").textContent = "Capa intradía aún sin datos (el vigía no ha corrido)."; return; }
    document.getElementById("lv-mercado").textContent = (iv.mercado.estado === "abierto" ? "🟢 MERCADO ABIERTO" : "🔴 MERCADO CERRADO") + " · " + iv.mercado.nota + " · " + (iv.mercado.hora_et || "").replace("T", " ") + ".";
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
      estadosViva(d);
    }).catch(function () {
      if (primerFallo) {
        primerFallo = false;
        document.getElementById("ev-posiciones").innerHTML = '<p class="tenue">Datos en vivo aún no disponibles.</p>';
      }
    });
  }
  cargar();
  setInterval(cargar, 60000);
})();
