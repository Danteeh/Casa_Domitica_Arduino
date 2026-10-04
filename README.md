# Casa Domotica (Capacitor + HTML/CSS/JS)

App para controlar el Arduino MEGA por Bluetooth, reemplazo de la version de
App Inventor. Conserva el mismo protocolo serie.

## Estructura

- `www/` - la aplicacion web (HTML/CSS/JS). Es lo que corre dentro del APK.
  - `index.html` - interfaz de la prueba minima (conectar, temp/hum, LED on/off).
  - `styles.css` - estilos.
  - `ble.js` - **capa de transporte**: decide entre Bluetooth real (Android)
    y simulador (navegador). El resto de la app no sabe cual se usa.
  - `app.js` - logica de la interfaz.
- `arduino/casa_domotica/casa_domotica.ino` - firmware mejorado (parser por
  lineas) con el MISMO protocolo que tu version anterior.
- `capacitor.config.json`, `package.json` - configuracion de Capacitor.

## Protocolo (firmware <-> app)

App -> Arduino (cada comando termina en `\n`):
- `L,<n>,<0|1>`   LED manual n (1..5).  Ej: `L,3,1` enciende el LED 3.
- `P,<p>,<0|1>`   Servo p (1=puerta principal, 2=garaje). 1=abrir, 0=cerrar.
- `AUTO,<0|1>`    Activa/desactiva el modo automatico del LDR.
- `PING`          El Arduino responde `PONG` (prueba de enlace).

Arduino -> App:
- `TEMP:28.5,HUM:44.4`   Telemetria DHT22.
- `AGUA:72`              Nivel de agua en %.
- `AGUA_ALERTA:1|0`      Alerta de desbordamiento.
- `PIR:1|0`              Movimiento detectado / ceso.
- `LDR:1|0`              Poca luz / luz suficiente.
- `LUZAUTO:1|0`          Estado del LED automatico (ultimo piso).
- `ACK,L,3,1`            Confirmacion de que un comando se aplico.

## Firmware y librerias

`arduino/casa_domotica/casa_domotica.ino` necesita dos librerias (instalalas
desde el Gestor de Librerias del IDE de Arduino):
- **DHT sensor library** (de Adafruit) + su dependencia **Adafruit Unified Sensor**.
- **Servo** (viene con el IDE).

Las conexiones fisicas de TODOS los componentes estan en
`docs/CONEXIONES.md` (tabla de pines, divisores, alimentacion de servos, BOM).

## Sketches de prueba por sensor

Antes de montar todo junto, prueba y calibra cada sensor por separado con los
sketches en `arduino/pruebas/`:
- `test_ldr/test_ldr.ino`     - calibra el umbral de luz del LDR.
- `test_agua/test_agua.ino`   - calibra el 0-100% del nivel de agua.
- `test_pir/test_pir.ino`     - verifica el PIR (dale 60 s para estabilizar).
- `test_servos/test_servos.ino` - ajusta los angulos de puerta y garaje.

## 1) Probar la interfaz en el PC (sin hardware)

Corre el servidor local y abre el navegador. Aqui el Bluetooth esta SIMULADO:
hay un "Arduino falso" que manda temperatura/humedad y responde al LED, para
que disenes la UI sin el telefono ni el Arduino.

```bat
cd "E:\Casa Do"
python -m http.server 5173 --bind 127.0.0.1 --directory www
```

Abre http://127.0.0.1:5173 . Pulsa **Conectar** -> veras valores subiendo y los
botones LED respondiendo en la consola.

## 2) Convertirla en APK Android

### Requisitos (una sola vez, en Windows)

- **Node.js 18+** (incluye npm). Descarga: https://nodejs.org
- **Java JDK 17** (Temurin/Adoptium funciona bien).
- **Android SDK**. Lo mas simple la primera vez: instalar **Android Studio**
  (solo para que baje el SDK; NO hay que usarlo para programar). Al abrirlo una
  vez, descarga el SDK automaticamente.
- Variable de entorno `JAVA_HOME` apuntando al JDK 17, y `ANDROID_HOME` /
  `ANDROID_SDK_ROOT` apuntando al SDK (normalmente
  `C:\Users\<tu_usuario>\AppData\Local\Android\Sdk`).

### Crear el proyecto Android y compilar

```bat
cd "E:\Casa Do"
npm install
npx cap add android
npx cap sync
```

`npm install` baja Capacitor y el plugin **@e-is/capacitor-bluetooth-serial**
(Bluetooth SPP clasico, el que habla con HC-05/HC-06).

Compilar el APK de depuracion:

```bat
cd android
gradlew.bat assembleDebug
```

El APK queda en:
`E:\Casa Do\android\app\build\outputs\apk\debug\app-debug.apk`

Pasalo al telefono (cable USB, o subelo a Drive y descargalo) e instalalo
permitiendo "instalar apps de origen desconocido".

> Cada vez que cambies algo en `www\`, ejecuta `npx cap sync` y vuelve a
> `gradlew.bat assembleDebug`. No hay que recrear el proyecto.

## 3) Permisos Bluetooth en Android

Tras `npx cap add android`, edita
`E:\Casa Do\android\app\src\main\AndroidManifest.xml` y confirma / agrega estos
permisos justo antes de la etiqueta `<application>`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

En Android 12+ la app pide `BLUETOOTH_CONNECT` / `BLUETOOTH_SCAN` en tiempo de
ejecucion (el plugin lo hace al llamar a Conectar/Buscar).

## 4) Flujo de prueba con el HC-05 real

1. **Empareja primero el HC-05 desde los Ajustes de Android**
   (Bluetooth -> buscar -> HC-05 -> PIN `1234` o `0000`). El HC-05 debe estar
   alimentado y con su LED parpadeando (modo no conectado).
2. Alimenta el Arduino MEGA con el firmware `casa_domotica.ino` flasheado.
   - IMPORTANTE: el HC-05 va en **Serial1** del MEGA (TX1 pin 18, RX1 pin 19).
     Conecta HC-05 TXD -> Arduino RX1(19), HC-05 RXD -> Arduino TX1(18) con
     divisor de tension (RXD del HC-05 es 3.3V). GND comun.
3. Abre la app en el telefono -> pulsa **Buscar** -> selecciona el HC-05 ->
   **Conectar**.
4. Debes ver `TEMP:xx.x,HUM:yy.y` actualizandose cada 2 s, y los botones
   **Encender / Apagar** moviendo el LED del pin 12.

Si "Buscar" no muestra el HC-05: confirma que esta emparejado en Ajustes y que
no esta ya conectado a otra app. Si conecta pero no llegan datos: revisa el
cruce TX/RX y que ambos esten a 9600 baudios.

## Nota sobre el plugin Bluetooth

`www\ble.js` usa **@e-is/capacitor-bluetooth-serial** (SPP clasico), que es lo
que habla el HC-05/HC-06. La Web Bluetooth API del navegador NO sirve aqui
porque solo habla BLE. Si algun dia cambias a un modulo BLE (HM-10, etc.), el
unico archivo a tocar es `www\ble.js` (funcion `makeNative`).
