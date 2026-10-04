/*
 * app.js  -  Logica de la interfaz.
 * Habla SIEMPRE a traves de `Transport` (ver ble.js), nunca directamente
 * con el plugin ni con el simulador.
 */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const el = {
    status: $("status"),
    statusText: $("statusText"),
    devices: $("devices"),
    btnRefresh: $("btnRefresh"),
    btnConnect: $("btnConnect"),
    btnDisconnect: $("btnDisconnect"),
    mode: $("mode"),
    temp: $("temp"),
    hum: $("hum"),
    btnLedOn: $("btnLedOn"),
    btnLedOff: $("btnLedOff"),
    ledState: $("ledState"),
    log: $("log"),
  };

  let connected = false;

  function log(line, dir) {
    const prefix = dir === "tx" ? ">> " : dir === "rx" ? "<< " : "   ";
    el.log.textContent += prefix + line + "\n";
    el.log.scrollTop = el.log.scrollHeight;
  }

  function setConnected(isConn) {
    connected = isConn;
    el.status.classList.toggle("status--on", isConn);
    el.status.classList.toggle("status--off", !isConn);
    el.statusText.textContent = isConn ? "Conectado" : "Desconectado";
    el.btnConnect.disabled = isConn;
    el.btnDisconnect.disabled = !isConn;
    el.btnLedOn.disabled = !isConn;
    el.btnLedOff.disabled = !isConn;
    if (!isConn) {
      el.temp.textContent = "--";
      el.hum.textContent = "--";
      el.ledState.textContent = "desconocido";
    }
  }

  // ---- Parseo de las lineas que manda el Arduino ----
  function handleLine(line) {
    log(line, "rx");

    // TEMP:28.5,HUM:44.4
    const m = line.match(/TEMP:([-\d.]+),HUM:([-\d.]+)/i);
    if (m) {
      el.temp.textContent = m[1];
      el.hum.textContent = m[2];
      return;
    }
    if (/LED 12 ENCENDIDO/i.test(line)) el.ledState.textContent = "ENCENDIDO";
    if (/LED 12 APAGADO/i.test(line)) el.ledState.textContent = "APAGADO";
  }

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
        opt.textContent = `${d.name}  [${d.address}]`;
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

  async function send(cmd) {
    try {
      log(cmd, "tx");
      await Transport.send(cmd + "\n");
    } catch (e) {
      log("Error al enviar: " + (e.message || e));
    }
  }

  // ---- Suscripciones del transporte ----
  Transport.onStatus((s) => setConnected(s.connected));
  Transport.onLine(handleLine);

  // ---- Eventos de UI ----
  el.btnRefresh.addEventListener("click", refreshDevices);
  el.btnConnect.addEventListener("click", connect);
  el.btnDisconnect.addEventListener("click", disconnect);
  el.btnLedOn.addEventListener("click", () => send("E,12"));
  el.btnLedOff.addEventListener("click", () => send("A,12"));

  // ---- Arranque ----
  el.mode.textContent =
    Transport.__mode === "native"
      ? "Modo: Bluetooth nativo (Android)"
      : "Modo: SIMULADOR (navegador) - Arduino falso para disenar la UI";
  setConnected(false);
  refreshDevices();
})();
