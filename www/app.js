/*
 * app.js  -  Logica de la interfaz completa.
 * Habla SIEMPRE por `Transport` (ble.js). Ver el protocolo en el firmware.
 */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const NUM_LEDS = 5;
  const ledNames = ["Sala", "Cocina", "Habitacion 1", "Habitacion 2", "Pasillo"];

  const el = {
    status: $("status"),
    statusText: $("statusText"),
    alertBanner: $("alertBanner"),
    devices: $("devices"),
    btnRefresh: $("btnRefresh"),
    btnConnect: $("btnConnect"),
    btnDisconnect: $("btnDisconnect"),
    mode: $("mode"),
    temp: $("temp"),
    hum: $("hum"),
    waterFill: $("waterFill"),
    waterPct: $("waterPct"),
    waterState: $("waterState"),
    leds: $("leds"),
    autoToggle: $("autoToggle"),
    ldrState: $("ldrState"),
    luzAutoState: $("luzAutoState"),
    door1State: $("door1State"),
    door2State: $("door2State"),
    pirDot: $("pirDot"),
    pirState: $("pirState"),
    pirTime: $("pirTime"),
    log: $("log"),
  };

  let connected = false;
  const ledState = [false, false, false, false, false];

  // ---------- Utilidades ----------
  function log(line, dir) {
    const prefix = dir === "tx" ? ">> " : dir === "rx" ? "<< " : "   ";
    el.log.textContent += prefix + line + "\n";
    el.log.scrollTop = el.log.scrollHeight;
    // Limitar el tamano del log para no crecer sin fin.
    const lines = el.log.textContent.split("\n");
    if (lines.length > 300) el.log.textContent = lines.slice(-300).join("\n");
  }

  function showAlert(text) {
    el.alertBanner.textContent = text;
    el.alertBanner.hidden = false;
  }
  function hideAlert() {
    el.alertBanner.hidden = true;
  }

  async function send(cmd) {
    try {
      log(cmd, "tx");
      await Transport.send(cmd + "\n");
    } catch (e) {
      log("Error al enviar: " + (e.message || e));
    }
  }

  // ---------- Construccion de los botones de LED ----------
  function buildLeds() {
    el.leds.innerHTML = "";
    for (let i = 1; i <= NUM_LEDS; i++) {
      const wrap = document.createElement("div");
      wrap.className = "led";
      wrap.innerHTML =
        '<div class="led__name">' + (ledNames[i - 1] || "LED " + i) + "</div>" +
        '<button class="btn led__btn" data-led="' + i + '" disabled>Apagado</button>';
      el.leds.appendChild(wrap);
    }
    el.leds.querySelectorAll(".led__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = +btn.dataset.led;
        const next = !ledState[n - 1];
        send("L," + n + "," + (next ? 1 : 0));
      });
    });
  }

  function renderLed(n) {
    const btn = el.leds.querySelector('.led__btn[data-led="' + n + '"]');
    if (!btn) return;
    const on = ledState[n - 1];
    btn.textContent = on ? "Encendido" : "Apagado";
    btn.classList.toggle("led__btn--on", on);
  }

  // ---------- Estado de conexion ----------
  function setConnected(isConn) {
    connected = isConn;
    el.status.classList.toggle("status--on", isConn);
    el.status.classList.toggle("status--off", !isConn);
    el.statusText.textContent = isConn ? "Conectado" : "Desconectado";
    el.btnConnect.disabled = isConn;
    el.btnDisconnect.disabled = !isConn;

    el.leds.querySelectorAll(".led__btn").forEach((b) => (b.disabled = !isConn));
    document.querySelectorAll(".door-open, .door-close").forEach((b) => (b.disabled = !isConn));
    el.autoToggle.disabled = !isConn;

    if (!isConn) {
      el.temp.textContent = "--";
      el.hum.textContent = "--";
      el.waterPct.textContent = "--";
      el.waterFill.style.height = "0%";
      el.waterState.textContent = "--";
      el.ldrState.textContent = "--";
      el.luzAutoState.textContent = "--";
      el.door1State.textContent = "--";
      el.door2State.textContent = "--";
      el.pirState.textContent = "Sin movimiento";
      el.pirDot.classList.remove("pir__dot--active");
      hideAlert();
    }
  }

  // ---------- Parseo de las lineas del Arduino ----------
  function handleLine(line) {
    log(line, "rx");
    let m;

    // TEMP:28.5,HUM:44.4
    if ((m = line.match(/TEMP:\s*([-\d.]+)\s*,\s*HUM:\s*([-\d.]+)/i))) {
      el.temp.textContent = m[1];
      el.hum.textContent = m[2];
      return;
    }

    // DHT_ERR:1  -> el sensor no da lectura valida
    if (/DHT_ERR:\s*1/i.test(line)) {
      el.temp.textContent = "err";
      el.hum.textContent = "err";
      return;
    }

    // AGUA:72  (sin ancla ^ para tolerar fragmentos pegados)
    if ((m = line.match(/AGUA:\s*(\d+)/i)) && !/AGUA_ALERTA/i.test(line)) {
      const pct = +m[1];
      el.waterPct.textContent = pct;
      el.waterFill.style.height = pct + "%";
      el.waterFill.classList.toggle("water__fill--high", pct >= 80);
      el.waterState.textContent =
        pct >= 95 ? "DESBORDE" : pct >= 80 ? "Lleno" : "Normal";
      return;
    }

    // AGUA_ALERTA:1 / :0
    if ((m = line.match(/AGUA_ALERTA:\s*([01])/i))) {
      if (m[1] === "1") showAlert("ALERTA: el tanque se va a desbordar");
      else hideAlert();
      return;
    }

    // PIR:1 / :0
    if ((m = line.match(/PIR:\s*([01])/i))) {
      const mov = m[1] === "1";
      el.pirState.textContent = mov ? "MOVIMIENTO DETECTADO" : "Sin movimiento";
      el.pirDot.classList.toggle("pir__dot--active", mov);
      if (mov) {
        el.pirTime.textContent = "Ultimo: " + new Date().toLocaleTimeString();
        showAlert("Movimiento detectado");
        setTimeout(hideAlert, 4000);
      }
      return;
    }

    // LDR:1 / :0
    if ((m = line.match(/LDR:\s*([01])/i))) {
      el.ldrState.textContent = m[1] === "1" ? "Poca luz" : "Luz suficiente";
      return;
    }

    // LUZAUTO:1 / :0
    if ((m = line.match(/LUZAUTO:\s*([01])/i))) {
      el.luzAutoState.textContent = m[1] === "1" ? "Encendido" : "Apagado";
      return;
    }

    // ACK,L,3,1  /  ACK,P,1,1  /  ACK,AUTO,1
    if ((m = line.match(/ACK,\s*L,\s*(\d+),\s*([01])/i))) {
      const n = +m[1];
      if (n >= 1 && n <= NUM_LEDS) {
        ledState[n - 1] = m[2] === "1";
        renderLed(n);
      }
      return;
    }
    if ((m = line.match(/ACK,\s*P,\s*([12]),\s*([01])/i))) {
      const estado = m[2] === "1" ? "Abierta" : "Cerrada";
      if (m[1] === "1") el.door1State.textContent = estado;
      else el.door2State.textContent = estado;
      return;
    }
    if ((m = line.match(/ACK,\s*AUTO,\s*([01])/i))) {
      el.autoToggle.checked = m[1] === "1";
      return;
    }
  }

  // ---------- Dispositivos / conexion ----------
  async function refreshDevices() {
    el.devices.innerHTML = "";
    try {
      const list = await Transport.list();
      if (!list.length) {
        const opt = document.createElement("option");
        opt.textContent = "(sin dispositivos emparejados)";
        opt.value = "";
        el.devices.appendChild(opt);
        return;
      }
      list.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.address;
        opt.textContent = d.name + "  [" + d.address + "]";
        el.devices.appendChild(opt);
      });
    } catch (e) {
      log("Error al listar: " + (e.message || e));
    }
  }

  async function connect() {
    const address = el.devices.value;
    try {
      log("Conectando a " + (address || "(simulador)") + " ...");
      await Transport.connect(address);
    } catch (e) {
      log("Error al conectar: " + (e.message || e));
      setConnected(false);
    }
  }

  async function disconnect() {
    try {
      await Transport.disconnect();
    } catch (e) {
      log("Error al desconectar: " + (e.message || e));
    }
  }

  // ---------- Suscripciones ----------
  Transport.onStatus((s) => setConnected(s.connected));
  Transport.onLine(handleLine);

  // ---------- Eventos de UI ----------
  el.btnRefresh.addEventListener("click", refreshDevices);
  el.btnConnect.addEventListener("click", connect);
  el.btnDisconnect.addEventListener("click", disconnect);

  document.querySelectorAll(".door-open").forEach((b) =>
    b.addEventListener("click", () => send("P," + b.dataset.door + ",1"))
  );
  document.querySelectorAll(".door-close").forEach((b) =>
    b.addEventListener("click", () => send("P," + b.dataset.door + ",0"))
  );
  el.autoToggle.addEventListener("change", () =>
    send("AUTO," + (el.autoToggle.checked ? 1 : 0))
  );

  // ---------- Arranque ----------
  buildLeds();
  el.mode.textContent =
    Transport.__mode === "native"
      ? "Modo: Bluetooth nativo (Android)"
      : "Modo: SIMULADOR (navegador) - Arduino falso para disenar la UI";
  setConnected(false);
  refreshDevices();
})();
