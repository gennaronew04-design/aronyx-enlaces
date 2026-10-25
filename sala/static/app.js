/* LA SALA ARONYX — replay en el cliente.
   TODO el estado se deriva del JSON de la sesión (curva + diario del motor real)
   según la fecha actual del replay. Ningún número se inventa aquí. */
"use strict";
const SVGNS = "http://www.w3.org/2000/svg";
const AGENTES = [
  { nombre: "ANSUZ",    runa: "ᚨ", estrategia: "A · Tendencia con medias", x: 128, y: 238 },
  { nombre: "THURISAZ", runa: "ᚦ", estrategia: "A · Rebote en MM50",       x: 250, y: 168 },
  { nombre: "SOWILO",   runa: "ᛋ", estrategia: "B · Ruptura con volumen",  x: 550, y: 168 },
  { nombre: "EHWAZ",    runa: "ᛖ", estrategia: "C · Retroceso a soporte",  x: 672, y: 238 },
  { nombre: "ALGIZ",    runa: "ᛉ", estrategia: "Vigía de riesgo · no opera", x: 400, y: 112, algiz: true },
];
const S = { data: null, i: 0, timer: null, velocidad: 1, fichaAbierta: null, mesCal: null };
const $ = id => document.getElementById(id);
const fmt$ = v => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = f => f; // ISO, sin ambigüedad

/* ---------- construcción de la sala (SVG) ---------- */
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function construirSala() {
  // hexágono central (aplastado en vertical: isométrico)
  const cx = 400, cy = 300, rx = 118, ry = 59;
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 3 * k + Math.PI / 6;
    pts.push((cx + rx * Math.cos(a)).toFixed(1) + "," + (cy + ry * Math.sin(a)).toFixed(1));
  }
  $("hex-puntos").setAttribute("points", pts.join(" "));
  $("hex-borde").setAttribute("points", pts.join(" "));
  // anillo elíptico para las runas
  $("anillo-runas").setAttribute("d", `M ${cx - 188},${cy} A 188,94 0 1,1 ${cx + 188},${cy} A 188,94 0 1,1 ${cx - 188},${cy}`);
  const runas = "ᚨᚦᛋᛖᛉᚱᚢᚾᚨᛊ";
  $("runas-texto").textContent = (runas.repeat(6)).slice(0, 52);

  const g = $("escritorios");
  for (const ag of AGENTES) {
    const grp = el("g", { transform: `translate(${ag.x},${ag.y})`, id: "desk-" + ag.nombre, class: ag.algiz ? "desk-algiz" : "" }, g);
    if (ag.algiz) el("polygon", { points: "-78,26 0,52 78,26 0,4", class: "plataforma" }, grp);
    // figura encapuchada detrás del escritorio
    const fig = el("g", { transform: "translate(0,-16)" }, grp);
    el("path", { d: "M-17,-16 Q0,-54 17,-16 L21,8 L-21,8 Z", class: "capucha" }, fig);
    el("ellipse", { cx: 0, cy: -25, rx: 8.5, ry: 10.5, class: "cara" }, fig);
    el("circle", { cx: -3.2, cy: -26, r: 1.4, class: "ojo" }, fig);
    el("circle", { cx: 3.2, cy: -26, r: 1.4, class: "ojo" }, fig);
    // monitores
    el("rect", { x: -42, y: -36, width: 34, height: 22, rx: 2, class: "monitor" }, grp);
    el("rect", { x: 8, y: -36, width: 34, height: 22, rx: 2, class: "monitor2" }, grp);
    el("polyline", { id: "spark-" + ag.nombre, class: "spark", points: "" }, grp);
    el("polyline", { id: "spark2-" + ag.nombre, class: "spark-spy", points: "" }, grp);
    // escritorio
    el("polygon", { points: "-54,0 0,-15 54,0 0,15", class: "desk-top" }, grp);
    el("polygon", { points: "-54,0 0,15 54,0 54,17 0,32 -54,17", class: "desk-front" }, grp);
    // placa con runa + nombre + luz de estado
    el("rect", { x: -48, y: 36, width: 96, height: 17, rx: 3, class: "placa" }, grp);
    const t = el("text", { x: 4, y: 48.5, class: "placa-texto" }, grp); t.textContent = ag.nombre;
    const r = el("text", { x: -38, y: 49, class: "runa" }, grp); r.textContent = ag.runa;
    el("circle", { id: "luz-" + ag.nombre, cx: 40, cy: 44.5, r: 5, fill: "#555", stroke: "#000" }, grp);
    if (ag.algiz) {
      const dd = el("text", { id: "algiz-dd", x: 0, y: 68, class: "algiz-dd" }, grp);
      dd.textContent = "DD 0.00 %";
    }
  }
}
function puntosSpark(agente, simbolo, hoy) {
  const velas = S.data.velas[simbolo] || S.data.velas.SPY;
  const serie = [];
  for (const [f, c] of velas) { if (f <= hoy) serie.push(c); else break; }
  const ult = serie.slice(-45);
  if (ult.length < 2) return "";
  const min = Math.min(...ult), max = Math.max(...ult), rg = (max - min) || 1;
  // monitor 1: x -39..-11, y -33..-17 (coordenadas locales del escritorio)
  return ult.map((c, k) => (-39 + 28 * k / (ult.length - 1)).toFixed(1) + "," + (-17 - 16 * (c - min) / rg).toFixed(1)).join(" ");
}
function puntosSparkSpy(hoy) {
  const velas = S.data.velas.SPY, serie = [];
  for (const [f, c] of velas) { if (f <= hoy) serie.push(c); else break; }
  const ult = serie.slice(-45);
  if (ult.length < 2) return "";
  const min = Math.min(...ult), max = Math.max(...ult), rg = (max - min) || 1;
  return ult.map((c, k) => (11 + 28 * k / (ult.length - 1)).toFixed(1) + "," + (-17 - 16 * (c - min) / rg).toFixed(1)).join(" ");
}

/* ---------- estado derivado del JSON ---------- */
function estado() {
  const d = S.data, hoy = d.curva[S.i][0], equity = d.curva[S.i][1];
  let peak = -Infinity;
  for (let k = 0; k <= S.i; k++) peak = Math.max(peak, d.curva[k][1]);
  const dd = peak > 0 ? (equity - peak) / peak : 0;
  const cerradas = d.diario.filter(t => t.fecha_salida <= hoy);
  const abiertas = d.diario.filter(t => t.fecha_entrada <= hoy && t.fecha_salida > hoy);
  const pnl = cerradas.reduce((a, t) => a + t["resultado_$"], 0);
  return { hoy, equity, peak, dd, cerradas, abiertas, pnl };
}
function statsAgente(nombre, est) {
  const cerr = est.cerradas.filter(t => t.agente === nombre);
  const abr = est.abiertas.filter(t => t.agente === nombre);
  const gan = cerr.filter(t => t["resultado_$"] > 0).length;
  const pnl = cerr.reduce((a, t) => a + t["resultado_$"], 0);
  const rprom = cerr.length ? cerr.reduce((a, t) => a + t.resultado_R, 0) / cerr.length : 0;
  return { n: cerr.length, abiertas: abr.length, aciertos: cerr.length ? gan / cerr.length * 100 : 0, pnl, rprom };
}

/* ---------- render ---------- */
function render() {
  if (!S.data) return;
  const est = estado(), d = S.data;
  $("fecha-actual").textContent = "📅 " + est.hoy;
  $("progreso").textContent = `día ${S.i + 1} de ${d.curva.length} · sesión ${d.id}`;
  // panel
  $("p-equity").textContent = fmt$(est.equity);
  const pnlEl = $("p-pnl");
  pnlEl.textContent = fmt$(est.pnl);
  pnlEl.className = est.pnl > 0 ? "pos" : (est.pnl < 0 ? "neg" : "");
  $("p-dd").textContent = (est.dd * 100).toFixed(2) + " %";
  $("p-ops").textContent = `${est.cerradas.length} cerradas · ${est.abiertas.length} abiertas`;
  dibujarCurva(est);
  // sala: luces, sparklines y ALGIZ
  for (const ag of AGENTES) {
    const luz = $("luz-" + ag.nombre);
    const cerrHoy = est.cerradas.filter(t => t.agente === ag.nombre && t.fecha_salida === est.hoy);
    const abr = est.abiertas.filter(t => t.agente === ag.nombre);
    if (ag.algiz) {
      const parada = d.fecha_parada && est.hoy >= d.fecha_parada;
      luz.setAttribute("fill", parada ? "#f87171" : "#2dd4bf");
      $("algiz-dd").textContent = parada ? "⛔ PARADA TOTAL" : "DD " + (est.dd * 100).toFixed(2) + " %";
      $("spark-ALGIZ").setAttribute("points", puntosSpark("ALGIZ", "SPY", est.hoy));
    } else if (cerrHoy.length) {
      const ultima = cerrHoy[cerrHoy.length - 1];
      luz.setAttribute("fill", ultima["resultado_$"] > 0 ? "#34d399" : "#f87171");
      $("spark-" + ag.nombre).setAttribute("points", puntosSpark(ag.nombre, ultima.simbolo, est.hoy));
    } else if (abr.length) {
      luz.setAttribute("fill", "#2dd4bf");
      $("spark-" + ag.nombre).setAttribute("points", puntosSpark(ag.nombre, abr[abr.length - 1].simbolo, est.hoy));
    } else {
      luz.setAttribute("fill", "#6b6350");
      $("spark-" + ag.nombre).setAttribute("points", puntosSpark(ag.nombre, "SPY", est.hoy));
    }
    $("spark2-" + ag.nombre).setAttribute("points", puntosSparkSpy(est.hoy));
  }
  $("parada-banner").style.display = (d.fecha_parada && est.hoy >= d.fecha_parada) ? "" : "none";
  renderAgentes(est);
  renderCalendario(est);
  publicarEstados3D(est);
  renderPresentacion(est);
}

/* ---------- puente con la vista 3D (mismos estados que la 2D) ---------- */
function publicarEstados3D(est) {
  if (!window.Sala3D || !Sala3D.setEstados) return;
  const mapa = {};
  for (const ag of AGENTES) {
    if (ag.algiz) {
      mapa[ag.nombre] = { dd: est.dd, paradaTotal: !!(S.data.fecha_parada && est.hoy >= S.data.fecha_parada) };
      continue;
    }
    const cerrHoy = est.cerradas.filter(t => t.agente === ag.nombre && t.fecha_salida === est.hoy);
    const abr = est.abiertas.filter(t => t.agente === ag.nombre);
    let estado3d = "inactivo";
    if (cerrHoy.length) estado3d = cerrHoy[cerrHoy.length - 1]["resultado_$"] > 0 ? "gano" : "perdio";
    else if (abr.length) estado3d = "abierta";
    mapa[ag.nombre] = { estado: estado3d };
  }
  try { Sala3D.setEstados(mapa); } catch (e) { /* si la 3D falla, la 2D sigue */ }
}

/* ---------- modo presentación 9:16 ---------- */
let salaOrigen = null;
function renderPresentacion(est) {
  if (!document.body.classList.contains("presentacion")) return;
  $("pres-fecha").textContent = "📅 " + est.hoy;
  $("pres-equity").textContent = fmt$(est.equity);
  const p = $("pres-pnl");
  p.textContent = fmt$(est.pnl);
  p.className = est.pnl > 0 ? "pos" : (est.pnl < 0 ? "neg" : "");
  $("pres-dd").textContent = (est.dd * 100).toFixed(2) + " %";
  $("pres-agentes").innerHTML = AGENTES.map(ag => {
    const luzEl = $("luz-" + ag.nombre);
    const color = luzEl ? luzEl.getAttribute("fill") : "#555";
    if (ag.algiz) {
      const parada = S.data.fecha_parada && est.hoy >= S.data.fecha_parada;
      return `<div class="pres-ag"><span class="luz" style="background:${color}"></span><b>${ag.runa} ${ag.nombre}</b><span>${parada ? "⛔ PARADA TOTAL" : "DD " + (est.dd * 100).toFixed(2) + " %"}</span></div>`;
    }
    const st = statsAgente(ag.nombre, est);
    return `<div class="pres-ag"><span class="luz" style="background:${color}"></span><b>${ag.runa} ${ag.nombre}</b><span class="${st.pnl > 0 ? "pos" : (st.pnl < 0 ? "neg" : "")}">${fmt$(st.pnl)} · ${st.n} ops</span></div>`;
  }).join("");
}
function activarPresentacion() {
  const wrap = $("sala-wrap");
  if (!salaOrigen) salaOrigen = { padre: wrap.parentNode, siguiente: wrap.nextSibling };
  $("pres-sala").appendChild(wrap);
  $("presentacion").hidden = false;
  document.body.classList.add("presentacion");
  window.scrollTo(0, 0);
  if (window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
  render();
}
function salirPresentacion() {
  const wrap = $("sala-wrap");
  if (salaOrigen) {
    if (salaOrigen.siguiente && salaOrigen.siguiente.parentNode === salaOrigen.padre) salaOrigen.padre.insertBefore(wrap, salaOrigen.siguiente);
    else salaOrigen.padre.appendChild(wrap);
  }
  $("presentacion").hidden = true;
  document.body.classList.remove("presentacion");
  if (window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
  render();
}

/* ---------- vista 2D / 3D ---------- */
function fijarVista(v) {
  S.vista = v;
  const es3d = v === "3d";
  $("wrap-3d").hidden = !es3d;
  $("wrap-2d").hidden = es3d;
  $("btn-vista-3d").classList.toggle("activo", es3d);
  $("btn-vista-2d").classList.toggle("activo", !es3d);
  if (window.Sala3D && Sala3D.setVisible) Sala3D.setVisible(es3d);
  if (es3d && window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
}
function dibujarCurva(est) {
  const cv = $("curva"), ctx = cv.getContext("2d");
  const W = cv.clientWidth || 600, H = 120, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const datos = S.data.curva.slice(0, S.i + 1).map(p => p[1]);
  const todos = S.data.curva.map(p => p[1]);
  const min = Math.min(...todos, S.data.capital), max = Math.max(...todos, S.data.capital);
  const rg = (max - min) || 1, n = S.data.curva.length;
  const X = k => 6 + (W - 12) * k / (n - 1), Y = v => H - 8 - (H - 20) * (v - min) / rg;
  // línea del capital inicial
  ctx.strokeStyle = "#3a2f10"; ctx.setLineDash([4, 4]); ctx.beginPath();
  ctx.moveTo(0, Y(S.data.capital)); ctx.lineTo(W, Y(S.data.capital)); ctx.stroke(); ctx.setLineDash([]);
  if (datos.length > 1) {
    ctx.beginPath();
    datos.forEach((v, k) => k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v)));
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(X(datos.length - 1), H - 8); ctx.lineTo(X(0), H - 8); ctx.closePath();
    ctx.fillStyle = "rgba(45,212,191,.13)"; ctx.fill();
    ctx.beginPath(); ctx.arc(X(datos.length - 1), Y(datos[datos.length - 1]), 3.5, 0, 7);
    ctx.fillStyle = "#2dd4bf"; ctx.fill();
  }
  ctx.fillStyle = "#9a917e"; ctx.font = "10px system-ui";
  ctx.fillText(fmt$(max), 6, 12); ctx.fillText(fmt$(min), 6, H - 12);
}
function renderAgentes(est) {
  const cont = $("agentes");
  cont.innerHTML = "";
  for (const ag of AGENTES) {
    const st = ag.algiz ? null : statsAgente(ag.nombre, est);
    const div = document.createElement("div");
    div.className = "agente" + (S.fichaAbierta === ag.nombre ? " abierta" : "");
    let statsHtml, fichaHtml = "";
    if (ag.algiz) {
      const parada = S.data.fecha_parada && est.hoy >= S.data.fecha_parada;
      statsHtml = `<div class="stats">
        <div><b>${(est.dd * 100).toFixed(2)} %</b><span>drawdown actual</span></div>
        <div><b>${parada ? "⛔ PARADA" : "vigilando"}</b><span>estado del riesgo</span></div>
        <div><b>${S.data.fecha_parada || "—"}</b><span>fecha de parada total</span></div></div>`;
      fichaHtml = `<div class="ficha"><p class="tenue">ALGIZ no opera: aplica el riesgo del 1 %, el tope del 25 %, el riesgo abierto ≤3 % y los frenos −2 % día / −4 % semana / −10 % drawdown. Señales rechazadas en la sesión completa: ${S.data.senales_rechazadas}.</p></div>`;
    } else {
      statsHtml = `<div class="stats">
        <div><b>${st.n}</b><span>operaciones</span></div>
        <div><b>${st.aciertos.toFixed(0)} %</b><span>aciertos</span></div>
        <div><b class="${st.pnl > 0 ? "pos" : (st.pnl < 0 ? "neg" : "")}">${fmt$(st.pnl)}</b><span>P&amp;L</span></div>
        <div><b>${st.rprom >= 0 ? "+" : ""}${st.rprom.toFixed(2)} R</b><span>R promedio</span></div>
        <div><b>${st.abiertas}</b><span>abiertas</span></div></div>`;
      const ops = S.data.diario.filter(t => t.agente === ag.nombre && t.fecha_entrada <= est.hoy)
        .sort((a, b) => a.fecha_entrada < b.fecha_entrada ? -1 : 1);
      const filas = ops.map(t => {
        const abierta = t.fecha_salida > est.hoy;
        return `<tr><td>${t.simbolo}</td><td>${t.fecha_entrada}<br>@ ${fmt$(t.entrada)}</td>` +
          (abierta
            ? `<td><span class="abierta-tag">ABIERTA</span></td><td>—</td>`
            : `<td>${t.fecha_salida}<br>@ ${fmt$(t.salida)}</td><td class="${t["resultado_$"] > 0 ? "pos" : "neg"}">${fmt$(t["resultado_$"])}<br>${t.resultado_R >= 0 ? "+" : ""}${t.resultado_R} R</td>`) +
          `</tr>`;
      }).join("");
      fichaHtml = `<div class="ficha">${ops.length
        ? `<table><tr><th>Símbolo</th><th>Entrada</th><th>Salida</th><th>Resultado</th></tr>${filas}</table>`
        : `<p class="tenue">Sin operaciones hasta esta fecha.</p>`}</div>`;
    }
    div.innerHTML = `<div class="cab"><span class="runa-g">${ag.runa}</span>
      <div><h3>${ag.nombre}</h3><span class="est">${ag.estrategia}</span></div>
      <span class="luz" style="background:${$("luz-" + ag.nombre) ? $("luz-" + ag.nombre).getAttribute("fill") : "#555"}"></span></div>
      ${statsHtml}${fichaHtml}`;
    div.addEventListener("click", ev => {
      if (ev.target.closest(".ficha")) return;
      S.fichaAbierta = S.fichaAbierta === ag.nombre ? null : ag.nombre;
      render();
    });
    cont.appendChild(div);
  }
}
function renderCalendario(est) {
  const cont = $("calendario");
  const [yy, mm] = est.hoy.split("-").map(Number);
  const clave = yy + "-" + mm;
  $("cal-titulo").textContent = est.hoy.slice(0, 7);
  // mapa fecha -> cambio diario de equity (desde la curva del motor)
  const mapa = {};
  S.data.curva.forEach((p, k) => {
    const prev = k ? S.data.curva[k - 1][1] : S.data.capital;
    mapa[p[0]] = { eq: p[1], chg: p[1] - prev, pct: prev ? (p[1] - prev) / prev * 100 : 0 };
  });
  cont.innerHTML = "";
  for (const dow of ["L", "M", "X", "J", "V", "S", "D"]) {
    const c = document.createElement("div"); c.className = "cal-dow"; c.textContent = dow; cont.appendChild(c);
  }
  const primero = new Date(Date.UTC(yy, mm - 1, 1));
  const offset = (primero.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  for (let k = 0; k < offset; k++) { const c = document.createElement("div"); c.className = "cal-dia fuera"; cont.appendChild(c); }
  for (let dia = 1; dia <= diasMes; dia++) {
    const f = `${yy}-${String(mm).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const c = document.createElement("div");
    const dato = mapa[f];
    c.className = "cal-dia" + (f === est.hoy ? " hoy" : "") + (dato ? "" : " fuera");
    if (dato) {
      const inten = Math.min(Math.abs(dato.pct) / 2.5, 1) * 0.55 + 0.08;
      c.style.background = dato.chg >= 0 ? `rgba(52,211,153,${inten})` : `rgba(248,113,113,${inten})`;
      c.innerHTML = `<span class="num">${dia}</span><span class="chg">${dato.pct >= 0 ? "+" : ""}${dato.pct.toFixed(2)} %</span>`;
      c.title = `${f} · P&L del día: ${fmt$(dato.chg)} · Equity: ${fmt$(dato.eq)}`;
      c.addEventListener("click", () => {
        $("cal-detalle").textContent = `📅 ${f} · P&L del día: ${fmt$(dato.chg)} (${dato.pct >= 0 ? "+" : ""}${dato.pct.toFixed(2)} %) · Equity: ${fmt$(dato.eq)}`;
      });
    } else {
      c.innerHTML = `<span class="num">${dia}</span>`;
      c.addEventListener("click", () => { $("cal-detalle").textContent = `📅 ${f} · sin sesión (fin de semana o festivo)`; });
    }
    cont.appendChild(c);
  }
  S.mesCal = clave;
}

/* ---------- chat con los agentes ----------
   Motor 100 % local y determinista: interpreta por palabras clave y calcula
   SOLO desde el JSON de la sesión, hasta el día actual del replay (S.i).
   Cero IA externa, cero números inventados. */
const ESTRATEGIAS_CHAT = {
  ANSUZ: "Opero la estrategia A, tendencia con medias: espero una tendencia sana —la media de 50 por encima de la de 200— y entro cuando el cierre supera el máximo de 20 días. Cada entrada nace con su stop y el riesgo por operación lo limita ALGIZ al 1 % de la cuenta.",
  THURISAZ: "Opero la estrategia A-rebote: en una tendencia sana espero el retroceso hasta la media de 50 y entro solo si hay rechazo en la MM50 confirmado al cierre siguiente. Sin confirmación, no hay operación.",
  SOWILO: "Opero la estrategia B, ruptura con volumen: entro cuando el cierre supera la resistencia del rango de 20 días con volumen relativo (RVOL) de al menos 1,5. Si el precio vuelve a cerrar dentro del rango, la ruptura era falsa y salgo.",
  EHWAZ: "Opero la estrategia C, retroceso a soporte: busco un retroceso sano hasta la MM50 con el RSI entre 40 y 50, y entro con rechazo y confirmación para retomar la tendencia.",
  ALGIZ: "Yo no opero: vigilo el riesgo de toda la sala. Aplico el riesgo del 1 % por operación, el tope del 25 % por posición, el riesgo abierto ≤3 % y los frenos: −2 % en un día, −4 % en la semana y parada total al −10 % de drawdown. También rechazo las señales de ruptura y retroceso que no ofrezcan al menos un 1:2 de beneficio/riesgo.",
  SALA: "Cada agente tiene la suya: ANSUZ la A de tendencia con medias, THURISAZ el rebote en la MM50, SOWILO la B de ruptura con volumen y EHWAZ la C de retroceso a soporte. ALGIZ no opera: pone los límites de riesgo. Pregúntale a cada uno por la suya."
};
const CHIPS_CHAT = {
  SALA: ["Resumen", "¿Quién va mejor?", "¿Quién va peor?", "¿Qué hay abierto?", "¿Hubo parada total?"],
  ALGIZ: ["¿A cuántos rechazaste?", "¿Hubo parada total?", "¿Cuáles son tus reglas?", "¿Cómo va la sala?"],
  defecto: ["¿Cómo vas?", "Tu mejor operación", "Tu peor operación", "¿Qué tienes abierto?", "¿Por qué entraste en tu última operación?", "¿Cuál es tu estrategia?"]
};
const INTERLOCUTORES = [["SALA", "La Sala"], ["ANSUZ", "ANSUZ"], ["THURISAZ", "THURISAZ"], ["SOWILO", "SOWILO"], ["EHWAZ", "EHWAZ"], ["ALGIZ", "ALGIZ"]];
S.chatInt = "SALA";

const normChat = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function ddMinHastaHoy() {
  const d = S.data; let peak = -Infinity, min = 0;
  for (let k = 0; k <= S.i; k++) {
    peak = Math.max(peak, d.curva[k][1]);
    if (peak > 0) min = Math.min(min, (d.curva[k][1] - peak) / peak);
  }
  return min;
}
function descOpChat(t, est, primera) {
  const cerrada = t.fecha_salida <= est.hoy;
  const v = primera ? ["Entré en", "con", "Salió"] : ["entró en", "con", "salió"];
  let s = `${v[0]} ${t.simbolo} el ${t.fecha_entrada} a ${fmt$(t.entrada)} ${v[1]} ${t.acciones} acciones (stop ${fmt$(t.stop)}, objetivo ${fmt$(t.objetivo)})`;
  if (cerrada) s += `. ${v[2]} el ${t.fecha_salida} a ${fmt$(t.salida)} por ${t.salida_por}: ${fmt$(t["resultado_$"])} (${t.resultado_R >= 0 ? "+" : ""}${t.resultado_R} R)`;
  else s += `. A día de hoy (${est.hoy}) sigue abierta`;
  return s;
}
function alcanceChat(est) {
  // operaciones dentro del alcance del interlocutor, hasta hoy
  if (S.chatInt === "SALA" || S.chatInt === "ALGIZ")
    return { cerr: est.cerradas, abr: est.abiertas };
  return {
    cerr: est.cerradas.filter(t => t.agente === S.chatInt),
    abr: est.abiertas.filter(t => t.agente === S.chatInt)
  };
}
function responderChat(textoCrudo) {
  const est = estado();
  const q = normChat(textoCrudo);
  const int_ = S.chatInt, esSala = int_ === "SALA", esAlgiz = int_ === "ALGIZ";
  const yo = !esSala && !esAlgiz; // operador en primera persona
  const { cerr, abr } = alcanceChat(est);
  const simb = Object.keys(S.data.velas).find(s => new RegExp("\\b" + s + "\\b").test(textoCrudo.toUpperCase()));

  // — ¿por qué entró en…? (campo "motivo" del diario)
  if (q.includes("por que") || q.includes("porque") || q.includes("entro en") || q.includes("entr") && q.includes("ultima") || q.includes("motivo") || q.includes("compraste")) {
    let candidatas = (simb ? est.diario.filter(t => t.simbolo === simb) : est.diario)
      .filter(t => (esSala || esAlgiz || t.agente === int_) && t.fecha_entrada <= est.hoy)
      .sort((a, b) => a.fecha_entrada < b.fecha_entrada ? -1 : 1);
    if (!candidatas.length)
      return simb
        ? `Hasta el ${est.hoy} no hay ninguna operación en ${simb} ${yo ? "mía" : "en el diario"} en esta sesión.`
        : `Hasta el ${est.hoy} todavía no hay entradas registradas ${yo ? "mías" : ""} en esta sesión.`;
    const t = candidatas[candidatas.length - 1];
    const prefijo = esSala || esAlgiz ? `${t.agente} ` : "";
    return `${prefijo}${descOpChat(t, est, yo)}. El motivo que dejó el motor en el diario: «${t.motivo}».`;
  }
  // — rechazos de ALGIZ (el JSON solo trae el total de la sesión, sin fechar)
  if (q.includes("rechaz")) {
    const n = S.data.senales_rechazadas;
    if (!n) return `En esta sesión no rechacé ninguna señal: el registro del motor marca 0 rechazos (${S.data.desde} → ${S.data.hasta}).`;
    return `El registro del motor marca ${n} señales rechazadas en la sesión completa (${S.data.desde} → ${S.data.hasta}): son entradas de ruptura o retroceso que no ofrecían al menos 1:2 o que rompían los límites de riesgo. El diario no fecha cada rechazo, así que no te invento un corte a ${est.hoy}: el total registrado es ${n}.`;
  }
  // — parada total (sin filtrar el futuro: solo si ya ocurrió al día actual)
  if (q.includes("parada")) {
    const ddMin = ddMinHastaHoy();
    if (S.data.fecha_parada && est.hoy >= S.data.fecha_parada)
      return `Sí. La parada total saltó el ${S.data.fecha_parada}: el drawdown cruzó el −10 % (el máximo registrado de la sesión es ${(S.data.dd_max * 100).toFixed(2)} %) y cerré la puerta a nuevas entradas.`;
    return `No, hasta hoy (${est.hoy}) no ha saltado la parada total. El peor drawdown hasta ahora es ${(ddMin * 100).toFixed(2)} %; la parada se activa al −10 %.`;
  }
  // — ranking entre agentes
  if (q.includes("quien") && (q.includes("mejor") || q.includes("peor"))) {
    const filas = AGENTES.filter(a => !a.algiz).map(a => {
      const st = statsAgente(a.nombre, est);
      return { nombre: a.nombre, pnl: st.pnl, n: st.n };
    }).sort((a, b) => b.pnl - a.pnl);
    if (!filas.some(f => f.n))
      return `Hasta el ${est.hoy} ningún agente ha cerrado operaciones todavía en esta sesión.`;
    const f = q.includes("mejor") ? filas[0] : filas[filas.length - 1];
    return `Hasta el ${est.hoy}, ${q.includes("mejor") ? "el mejor" : "el peor"} es ${f.nombre}: P&L de ${fmt$(f.pnl)} con ${f.n} operaciones cerradas. El ranking completo: ${filas.map(x => `${x.nombre} ${fmt$(x.pnl)}`).join(" · ")}.`;
  }
  // — mejor / peor operación
  if (q.includes("mejor") || q.includes("peor")) {
    if (!cerr.length) return `Todavía no ${yo ? "he" : "hay"} operaciones cerradas hasta el ${est.hoy} en esta sesión.`;
    const ord = [...cerr].sort((a, b) => a["resultado_$"] - b["resultado_$"]);
    const t = q.includes("mejor") ? ord[ord.length - 1] : ord[0];
    const prefijo = esSala || esAlgiz ? `${t.agente} · ` : `${yo ? "Mi" : "La"} ${q.includes("mejor") ? "mejor" : "peor"} operación hasta el ${est.hoy}: `;
    return `${prefijo}${esSala || esAlgiz ? descOpChat(t, est, false) : descOpChat(t, est, yo)}${esSala || esAlgiz ? "" : ""}.`;
  }
  // — qué hay abierto
  if (q.includes("abiert")) {
    if (!abr.length) return `A ${est.hoy} no ${yo ? "tengo" : "hay"} ninguna posición abierta${yo ? "" : " en la sala"}.`;
    const lista = abr.map(t => `${esSala || esAlgiz ? t.agente + " · " : ""}${descOpChat(t, est, yo)}`).join("\n");
    return `${yo ? "Tengo" : "Hay"} ${abr.length} abierta${abr.length > 1 ? "s" : ""} a ${est.hoy}:\n${lista}`;
  }
  // — estrategia / reglas
  if (q.includes("estrategia") || q.includes("reglas") || q.includes("como operas") || q.includes("que haces")) {
    return ESTRATEGIAS_CHAT[int_];
  }
  // — resumen de la sala
  if (q.includes("resumen") || q.includes("como va la sala")) {
    const porAg = AGENTES.filter(a => !a.algiz).map(a => {
      const st = statsAgente(a.nombre, est);
      return `${a.nombre}: ${fmt$(st.pnl)} (${st.n} cerr.)`;
    }).join(" · ");
    return `Sesión ${S.data.id} (${S.data.nombre}) a ${est.hoy}, día ${S.i + 1} de ${S.data.curva.length}. Equity ${fmt$(est.equity)} desde ${fmt$(S.data.capital)} inicial. P&L realizado ${fmt$(est.pnl)} con ${est.cerradas.length} operaciones cerradas y ${est.abiertas.length} abiertas. Drawdown actual ${(est.dd * 100).toFixed(2)} %. Por agentes: ${porAg}. Y recuerda: la métrica reina es el cumplimiento del plan, no el P&L.`;
  }
  // — estado / cómo vas
  if (q.includes("como vas") || q.includes("como va") || q.includes("estado") || q.includes("cuantas") || q.includes("operaciones") || q.includes("numeros")) {
    if (esAlgiz)
      return `Estoy vigilando. Drawdown actual de la sala: ${(est.dd * 100).toFixed(2)} % (peor hasta hoy: ${(ddMinHastaHoy() * 100).toFixed(2)} %). Equity ${fmt$(est.equity)}, P&L realizado ${fmt$(est.pnl)}, ${est.cerradas.length} operaciones cerradas y ${est.abiertas.length} abiertas a ${est.hoy}. ${S.data.fecha_parada && est.hoy >= S.data.fecha_parada ? "La parada total ya saltó el " + S.data.fecha_parada + "." : "Sin parada total hasta hoy."}`;
    if (esSala)
      return `La sala va así a ${est.hoy}: equity ${fmt$(est.equity)}, P&L realizado ${fmt$(est.pnl)}, ${est.cerradas.length} cerradas y ${est.abiertas.length} abiertas, drawdown ${(est.dd * 100).toFixed(2)} %. Pídeme el «Resumen» para verlo agente por agente.`;
    const st = statsAgente(int_, est);
    if (!st.n && !st.abiertas)
      return `Hasta el ${est.hoy} todavía no he operado en esta sesión: cero operaciones cerradas y nada abierto. Mi estrategia espera su señal; si quieres, te cuento cuál es.`;
    return `Hasta el ${est.hoy} llevo ${st.n} operaciones cerradas, con un ${st.aciertos.toFixed(0)} % de aciertos y un P&L de ${fmt$(st.pnl)} (R promedio ${st.rprom >= 0 ? "+" : ""}${st.rprom.toFixed(2)} R). Tengo ${st.abiertas} abierta${st.abiertas === 1 ? "" : "s"} ahora mismo.`;
  }
  // — no entendido
  return `Esa no la tengo en mi diario. Puedo responderte con los números de la sesión hasta el ${est.hoy}: cómo ${yo ? "voy" : "va la sala"}, ${yo ? "mi" : "la"} mejor y ${yo ? "mi" : "la"} peor operación, qué hay abierto, por qué ${yo ? "entré" : "se entró"} en una operación (dime el símbolo) o cuál es ${yo ? "mi" : "cada"} estrategia. Prueba con los botones de arriba.`;
}
function chatMensaje(quien, texto, clase) {
  const v = $("chat-ventana");
  const div = document.createElement("div");
  div.className = "msg " + clase;
  const cab = document.createElement("span");
  cab.className = "quien"; cab.textContent = quien;
  div.appendChild(cab);
  div.appendChild(document.createTextNode(texto));
  v.appendChild(div);
  v.scrollTop = v.scrollHeight;
}
function chatSaludo() {
  if (!S.data) return;
  const hoy = S.data.curva[S.i][0], id = S.data.id;
  const saludos = {
    SALA: `Soy la Sala. Te cuento lo que pasa aquí dentro con los números del diario de la sesión ${id}, hasta el día que marque el replay (${hoy}).`,
    ALGIZ: `Soy ALGIZ ᛉ, el vigía de riesgo. No opero: controlo el 1 % por operación, los frenos y la parada total. Pregúntame por los rechazos y el drawdown de la sesión ${id}.`,
  };
  const ag = AGENTES.find(a => a.nombre === S.chatInt);
  chatMensaje(S.chatInt === "SALA" ? "La Sala" : S.chatInt,
    saludos[S.chatInt] || `Soy ${ag.nombre} ${ag.runa}, ${ag.estrategia}. Pregúntame por mis números: salen del diario de la sesión ${id}, hasta el día actual del replay (${hoy}). Nada inventado.`,
    "agente");
}
function pintarChipsChat() {
  const lista = CHIPS_CHAT[S.chatInt] || CHIPS_CHAT.defecto;
  $("chat-chips").innerHTML = "";
  for (const txt of lista) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = txt;
    b.addEventListener("click", () => enviarPreguntaChat(txt));
    $("chat-chips").appendChild(b);
  }
}
function fijarInterlocutor(nombreInt) {
  S.chatInt = nombreInt;
  document.querySelectorAll("#chat-tabs .chat-tab").forEach(b => b.classList.toggle("activo", b.dataset.int === nombreInt));
  $("chat-ventana").innerHTML = "";
  pintarChipsChat();
  chatSaludo();
}
function enviarPreguntaChat(txt) {
  const limpio = (txt || "").trim();
  if (!limpio || !S.data) return;
  chatMensaje("Tú", limpio, "tu");
  chatMensaje(S.chatInt === "SALA" ? "La Sala" : S.chatInt, responderChat(limpio), "agente");
  $("chat-input").value = "";
}
function iniciarChat() {
  const tabs = $("chat-tabs");
  tabs.innerHTML = "";
  for (const [valor, etiqueta] of INTERLOCUTORES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chat-tab" + (valor === S.chatInt ? " activo" : "");
    b.dataset.int = valor; b.textContent = etiqueta;
    b.addEventListener("click", () => fijarInterlocutor(valor));
    tabs.appendChild(b);
  }
  $("chat-form").addEventListener("submit", e => {
    e.preventDefault();
    enviarPreguntaChat($("chat-input").value);
  });
  pintarChipsChat();
}

/* ---------- controles del replay ---------- */
function parar() {
  if (S.timer) { clearInterval(S.timer); S.timer = null; $("btn-play").textContent = "▶ Play"; }
}
function reproducir() {
  parar();
  $("btn-play").textContent = "⏸ Pausa";
  S.timer = setInterval(() => {
    if (S.i < S.data.curva.length - 1) { S.i++; render(); }
    else parar();
  }, 500 / S.velocidad);
}
async function cargarSesion(id) {
  parar();
  const r = await fetch("datos_web/" + id + ".json");
  S.data = await r.json();
  S.i = 0; S.fichaAbierta = null;
  render();
  fijarInterlocutor(S.chatInt); // el chat saluda con la sesión nueva
}
async function iniciar() {
  construirSala();
  const r = await fetch("datos_web/sesiones.json");
  const sesiones = await r.json();
  const sel = $("sel-sesion");
  sel.innerHTML = sesiones.map(s => `<option value="${s.id}">${s.id} · ${s.nombre} (${s.operaciones} ops)</option>`).join("");
  sel.addEventListener("change", () => cargarSesion(sel.value));
  $("btn-play").addEventListener("click", () => S.timer ? parar() : reproducir());
  $("btn-reiniciar").addEventListener("click", () => { parar(); S.i = 0; render(); });
  $("sel-velocidad").addEventListener("change", e => {
    S.velocidad = Number(e.target.value);
    if (S.timer) reproducir();
  });
  // vista 3D (principal) / 2D (ligera): si WebGL no está, se queda la 2D sin error
  let ok3d = false;
  if (window.Sala3D && Sala3D.iniciar) {
    try { ok3d = !!Sala3D.iniciar($("sala3d")); } catch (e) { ok3d = false; }
  }
  if (!ok3d) { $("btn-vista-3d").disabled = true; $("btn-vista-3d").title = "WebGL no disponible en este navegador"; }
  $("btn-vista-3d").addEventListener("click", () => fijarVista("3d"));
  $("btn-vista-2d").addEventListener("click", () => fijarVista("2d"));
  fijarVista(ok3d ? "3d" : "2d");
  // modo presentación 9:16
  $("btn-presentacion").addEventListener("click", activarPresentacion);
  $("btn-salir-pres").addEventListener("click", salirPresentacion);
  // chat con los agentes
  iniciarChat();
  window.addEventListener("resize", () => {
    render();
    if (window.Sala3D && Sala3D.redimensionar) Sala3D.redimensionar();
  });
  if (sesiones.length) { sel.value = sesiones[0].id; await cargarSesion(sesiones[0].id); }
}
document.addEventListener("DOMContentLoaded", iniciar);
