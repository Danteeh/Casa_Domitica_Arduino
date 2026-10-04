/*
 * ble.js  -  Capa de transporte Bluetooth.
 *
 * Expone un objeto global `Transport` con una API uniforme para que el resto
 * de la app NO sepa si esta hablando por Bluetooth real (Android) o por el
 * simulador (navegador de escritorio).
 *
 * API:
 *   Transport.isNative()                 -> true si corre dentro de Capacitor
 *   Transport.list()                     -> Promise<[{name, address}]> dispositivos emparejados
 *   Transport.connect(address)           -> Promise<void>
 *   Transport.disconnect()               -> Promise<void>
 *   Transport.send(text)                 -> Promise<void>   (envia "E,12\n" etc)
 *   Transport.onLine(cb)                 -> cb(line) por cada linea recibida del Arduino
 *   Transport.onStatus(cb)               -> cb({connected:boolean})
 *
 * En Android usa el plugin SPP clasico (HC-05 / HC-06).
 * En el navegador usa un Arduino falso para disenar la UI sin hardware.
 */

(function () {
  "use strict";

  const lineSubs = [];
  const statusSubs = [];
  let rxBuffer = "";

  function emitLine(line) {
    line = line.trim();
    if (line) lineSubs.forEach((cb) => cb(line));
  }
  function emitStatus(connected) {
    statusSubs.forEach((cb) => cb({ connected }));
  }

  // Acumula los bytes/trozos que llegan y los corta por salto de linea.
  function feed(chunk) {
    rxBuffer += chunk;
    let idx;
    while ((idx = rxBuffer.indexOf("\n")) >= 0) {
      const line = rxBuffer.slice(0, idx);
      rxBuffer = rxBuffer.slice(idx + 1);
      emitLine(line);
    }
  }

  const isCapacitor =
    typeof window !== "undefined" &&
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform();

  // -------------------------------------------------------------------------
  // Implementacion NATIVA (Android, plugin @e-is/capacitor-bluetooth-serial)
  //
  // API real del plugin (todas las llamadas llevan { address }):
  //   isEnabled()  enable()  scan() -> {devices:[{name,address,id}]}
  //   connect({address})  disconnect({address})
  //   startNotifications({address, delimiter})  -> emite evento 'onRead'
  //   addListener('onRead', ({value}) => ...)
  //   write({address, value})
  //
  // Como pasamos delimiter '\n', el plugin ya nos entrega UNA LINEA completa
  // en cada 'onRead', asi que la emitimos directa (no usamos el buffer feed()).
  // -------------------------------------------------------------------------
  function makeNative() {
    const BluetoothSerial = window.Capacitor.Plugins.BluetoothSerial;
    const DELIM = "\n";

    let readListener = null;
    let currentAddress = null;

    return {
      isNative: () => true,

      async list() {
        // Asegurar que el Bluetooth esta encendido (y pedir permisos).
        try {
          const en = await BluetoothSerial.isEnabled();
          if (en && en.enabled === false) {
            await BluetoothSerial.enable();
          }
        } catch (_) {
          // enable() tambien dispara el dialogo de permisos en Android 12+.
          try { await BluetoothSerial.enable(); } catch (_) {}
        }

        // scan() descubre dispositivos visibles / emparejados cercanos.
        const res = await BluetoothSerial.scan();
        const devices = (res && res.devices) || [];
        return devices.map((d) => ({
          name: d.name || "(sin nombre)",
          address: d.address || d.id,
        }));
      },

      async connect(address) {
        if (!address) throw new Error("Selecciona un dispositivo primero");
        currentAddress = address;

        await BluetoothSerial.connect({ address });

        // Escuchar lineas entrantes (el plugin corta por el delimiter).
        readListener = await BluetoothSerial.addListener("onRead", (data) => {
          const value = (data && data.value) || "";
          // Puede venir sin el '\n' final; lo normalizamos por si acaso.
          String(value)
            .split(/\r?\n/)
            .forEach((part) => emitLine(part));
        });

        await BluetoothSerial.startNotifications({ address, delimiter: DELIM });
        emitStatus(true);
      },

      async disconnect() {
        try {
          if (currentAddress) {
            try {
              await BluetoothSerial.stopNotifications({ address: currentAddress });
            } catch (_) {}
            await BluetoothSerial.disconnect({ address: currentAddress });
          }
          if (readListener && readListener.remove) await readListener.remove();
        } finally {
          readListener = null;
          currentAddress = null;
          emitStatus(false);
        }
      },

      async send(text) {
        if (!currentAddress) throw new Error("No conectado");
        await BluetoothSerial.write({ address: currentAddress, value: text });
      },

      onLine(cb) {
        lineSubs.push(cb);
      },
      onStatus(cb) {
        statusSubs.push(cb);
      },
    };
  }

  // -------------------------------------------------------------------------
  // Implementacion SIMULADA (navegador de escritorio) - Arduino falso
  // -------------------------------------------------------------------------
  function makeSim() {
    let connected = false;
    let timer = null;
    let ledOn = false;
    let temp = 28.5;
    let hum = 44.4;

    function startTelemetry() {
      stopTelemetry();
      timer = setInterval(() => {
        // Pequena deriva aleatoria para que se vea "vivo".
        temp = +(temp + (Math.random() - 0.5) * 0.4).toFixed(1);
        hum = +(hum + (Math.random() - 0.5) * 0.6).toFixed(1);
        if (temp < 20) temp = 20;
        if (temp > 35) temp = 35;
        if (hum < 30) hum = 30;
        if (hum > 70) hum = 70;
        feed(`TEMP:${temp.toFixed(1)},HUM:${hum.toFixed(1)}\n`);
      }, 2000);
    }
    function stopTelemetry() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    return {
      isNative: () => false,

      async list() {
        return [
          { name: "HC-05 (simulado)", address: "00:00:00:00:00:00" },
        ];
      },

      async connect() {
        connected = true;
        emitStatus(true);
        feed("Sistema iniciado\n");
        startTelemetry();
      },

      async disconnect() {
        connected = false;
        stopTelemetry();
        emitStatus(false);
      },

      async send(text) {
        // Simula el parser del Arduino.
        const cmd = text.trim();
        if (cmd === "E,12") {
          ledOn = true;
          feed("LED 12 ENCENDIDO\n");
        } else if (cmd === "A,12") {
          ledOn = false;
          feed("LED 12 APAGADO\n");
        }
      },

      onLine(cb) {
        lineSubs.push(cb);
      },
      onStatus(cb) {
        statusSubs.push(cb);
      },
    };
  }

  window.Transport = isCapacitor ? makeNative() : makeSim();
  window.Transport.__mode = isCapacitor ? "native" : "sim";
})();
