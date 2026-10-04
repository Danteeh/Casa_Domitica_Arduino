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

        // Escuchar datos entrantes. El firmware ahora termina cada mensaje
        // con un unico '\n'. Pasamos el valor CRUDO al buffer, que acumula y
        // corta por '\n'; emitLine() hace trim() y limpia cualquier '\r'.
        readListener = await BluetoothSerial.addListener("onRead", (data) => {
          const value = (data && data.value) || "";
          feed(String(value) + "\n");
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
  // Implementacion SIMULADA (navegador de escritorio) - Arduino falso completo
  // -------------------------------------------------------------------------
  function makeSim() {
    let timer = null;
    let temp = 28.5;
    let hum = 44.4;
    let agua = 60;
    let aguaSubiendo = true;
    let aguaAlerta = false;
    let modoAuto = true;
    let ldrPoca = false;
    let luzAuto = false;
    let tick = 0;

    function startTelemetry() {
      stopTelemetry();
      timer = setInterval(() => {
        tick++;

        // Ambiente
        temp = +(temp + (Math.random() - 0.5) * 0.4).toFixed(1);
        hum = +(hum + (Math.random() - 0.5) * 0.6).toFixed(1);
        temp = Math.min(35, Math.max(20, temp));
        hum = Math.min(70, Math.max(30, hum));
        feed(`TEMP:${temp.toFixed(1)},HUM:${hum.toFixed(1)}\n`);

        // Agua: sube y baja despacio para probar el umbral de desborde
        agua += aguaSubiendo ? 4 : -4;
        if (agua >= 100) { agua = 100; aguaSubiendo = false; }
        if (agua <= 20) { agua = 20; aguaSubiendo = true; }
        feed(`AGUA:${Math.round(agua)}\n`);
        const alerta = agua >= 95;
        if (alerta !== aguaAlerta) {
          aguaAlerta = alerta;
          feed(`AGUA_ALERTA:${alerta ? 1 : 0}\n`);
        }

        // LDR: alterna poca/mucha luz cada ~10 s para ver el modo auto
        if (tick % 5 === 0) {
          ldrPoca = !ldrPoca;
          feed(`LDR:${ldrPoca ? 1 : 0}\n`);
          if (modoAuto) {
            luzAuto = ldrPoca;
            feed(`LUZAUTO:${luzAuto ? 1 : 0}\n`);
          }
        }

        // PIR: pulso de movimiento ocasional
        if (tick % 7 === 0) {
          feed("PIR:1\n");
          feed("LUZAUTO:1\n");
          setTimeout(() => feed("PIR:0\n"), 1500);
        }
      }, 2000);
    }
    function stopTelemetry() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    return {
      isNative: () => false,

      async list() {
        return [{ name: "HC-05 (simulado)", address: "00:00:00:00:00:00" }];
      },

      async connect() {
        emitStatus(true);
        feed("Sistema iniciado\n");
        startTelemetry();
      },

      async disconnect() {
        stopTelemetry();
        emitStatus(false);
      },

      async send(text) {
        // Emula el parser del firmware real.
        const cmd = text.trim();
        let m;
        if ((m = cmd.match(/^L,(\d+),([01])$/))) {
          feed(`ACK,L,${m[1]},${m[2]}\n`);
        } else if ((m = cmd.match(/^P,([12]),([01])$/))) {
          feed(`ACK,P,${m[1]},${m[2]}\n`);
        } else if ((m = cmd.match(/^AUTO,([01])$/))) {
          modoAuto = m[1] === "1";
          feed(`ACK,AUTO,${m[1]}\n`);
          if (!modoAuto) { luzAuto = false; feed("LUZAUTO:0\n"); }
        } else if (cmd === "PING") {
          feed("PONG\n");
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
