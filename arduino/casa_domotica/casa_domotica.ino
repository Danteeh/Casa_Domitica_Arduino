/*
 * casa_domotica.ino  -  Firmware COMPLETO de la casa domotica.
 *
 * Arduino MEGA 2560 + HC-05/06 (Serial1) + DHT22 + PIR + nivel de agua +
 * LDR + 5 LEDs manuales + 1 LED automatico + 2 servos (puerta y garaje).
 *
 * ---------------------------------------------------------------------------
 * PROTOCOLO
 * ---------------------------------------------------------------------------
 * App -> Arduino (cada comando termina en '\n'):
 *   L,<n>,<0|1>      LED manual n (1..5). Ej: "L,3,1" enciende el LED 3.
 *   P,<p>,<0|1>      Servo p (1=puerta principal, 2=garaje). 1=abrir, 0=cerrar.
 *   AUTO,<0|1>       Activa (1) / desactiva (0) el modo automatico del LDR.
 *   PING             El Arduino responde "PONG" (prueba de enlace).
 *
 * Arduino -> App (una linea por mensaje):
 *   TEMP:28.5,HUM:44.4     Telemetria DHT22 (cada 2 s).
 *   AGUA:72                Nivel de agua en % (cada 2 s).
 *   AGUA_ALERTA:1 / :0     Cruce del umbral de desbordamiento.
 *   PIR:1 / :0             Movimiento detectado / ceso.
 *   LDR:1 / :0             Poca luz (1) / luz suficiente (0).
 *   LUZAUTO:1 / :0         Estado del LED automatico del ultimo piso.
 *   ACK,L,3,1              Confirmacion de un comando aplicado.
 *
 * ---------------------------------------------------------------------------
 * CONEXIONES (ver tambien docs/CONEXIONES.md)
 * ---------------------------------------------------------------------------
 *   HC-05  TXD -> MEGA RX1 (pin 19)   [directo]
 *   HC-05  RXD -> MEGA TX1 (pin 18)   [con divisor 1k/2k -> 3.3V]
 *   HC-05  VCC -> 5V        GND -> GND
 *
 *   DHT22  DATA -> pin 2  (resistencia 10k entre DATA y VCC)
 *   PIR    OUT  -> pin 3
 *   LDR    -> divisor con 10k a A0  (LDR entre 5V y A0, 10k entre A0 y GND)
 *   NIVEL AGUA (señal) -> A1
 *
 *   LEDs manuales (cada uno con resistencia 220 ohm a GND):
 *     LED1 -> pin 4    LED2 -> pin 5    LED3 -> pin 6
 *     LED4 -> pin 7    LED5 -> pin 8
 *   LED automatico (ultimo piso) -> pin 9   (220 ohm a GND)
 *
 *   Servo puerta principal -> señal pin 10   (VCC 5V externo recomendado)
 *   Servo garaje           -> señal pin 11   (VCC 5V externo recomendado)
 *     IMPORTANTE: alimenta los servos con fuente 5V aparte y une los GND.
 * ---------------------------------------------------------------------------
 */

#include <DHT.h>
#include <Servo.h>

// ----------------- Pines -----------------
#define DHTPIN      2
#define DHTTYPE     DHT22
#define PIR_PIN     3
#define PIN_LDR     A0
#define PIN_AGUA    A1
#define LED_AUTO    9
#define SERVO_PUERTA_PIN 10
#define SERVO_GARAJE_PIN 11

const uint8_t ledPins[5] = {4, 5, 6, 7, 8};  // LED1..LED5 manuales

// ----------------- Umbrales -----------------
const int LDR_UMBRAL     = 400;   // < este valor analogico = poca luz (ajustable)
const int AGUA_LLENO     = 80;    // % a partir del cual se considera "lleno"
const int AGUA_DESBORDE  = 95;    // % que dispara la alerta de desbordamiento

// ----------------- Objetos -----------------
DHT dht(DHTPIN, DHTTYPE);
Servo servoPuerta;
Servo servoGaraje;

// ----------------- Estado -----------------
unsigned long tLast = 0;
const unsigned long INTERVALO = 2000;   // telemetria cada 2 s

bool modoAuto     = true;    // modo automatico del LDR activo al arrancar
bool pirPrev      = false;
bool ldrPrev      = false;
bool aguaAlertaPrev = false;
bool luzAutoPrev  = false;

void setup() {
  // LEDs
  for (uint8_t i = 0; i < 5; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(LED_AUTO, OUTPUT);
  digitalWrite(LED_AUTO, LOW);

  // PIR
  pinMode(PIR_PIN, INPUT);

  // Servos (posicion cerrada al inicio)
  servoPuerta.attach(SERVO_PUERTA_PIN);
  servoGaraje.attach(SERVO_GARAJE_PIN);
  servoPuerta.write(0);
  servoGaraje.write(0);

  Serial.begin(9600);
  Serial1.begin(9600);

  dht.begin();

  Serial.println(F("Sistema iniciado"));
}

void loop() {
  // 1) Comandos entrantes
  if (Serial1.available()) {
    String linea = Serial1.readStringUntil('\n');
    linea.trim();
    if (linea.length() > 0) {
      Serial.print(F("RX: "));
      Serial.println(linea);
      procesarComando(linea);
    }
  }

  // 2) Eventos instantaneos (PIR) se revisan en cada vuelta
  revisarPIR();

  // 3) Telemetria periodica
  if (millis() - tLast >= INTERVALO) {
    tLast = millis();
    enviarDHT();
    revisarAgua();
    revisarLDR();
  }
}

// ===========================================================================
//  COMANDOS
// ===========================================================================
void procesarComando(const String &cmd) {
  // L,<n>,<estado>
  if (cmd.startsWith("L,")) {
    int c1 = cmd.indexOf(',');
    int c2 = cmd.indexOf(',', c1 + 1);
    if (c2 > 0) {
      int n = cmd.substring(c1 + 1, c2).toInt();      // 1..5
      int estado = cmd.substring(c2 + 1).toInt();     // 0/1
      if (n >= 1 && n <= 5) {
        digitalWrite(ledPins[n - 1], estado ? HIGH : LOW);
        enviarLinea("ACK,L," + String(n) + "," + String(estado));
      }
    }
    return;
  }

  // P,<puerta>,<estado>
  if (cmd.startsWith("P,")) {
    int c1 = cmd.indexOf(',');
    int c2 = cmd.indexOf(',', c1 + 1);
    if (c2 > 0) {
      int p = cmd.substring(c1 + 1, c2).toInt();      // 1=puerta 2=garaje
      int estado = cmd.substring(c2 + 1).toInt();     // 1=abrir 0=cerrar
      int angulo = estado ? 90 : 0;
      if (p == 1) servoPuerta.write(angulo);
      else if (p == 2) servoGaraje.write(angulo);
      enviarLinea("ACK,P," + String(p) + "," + String(estado));
    }
    return;
  }

  // AUTO,<0|1>
  if (cmd.startsWith("AUTO,")) {
    modoAuto = cmd.substring(5).toInt() == 1;
    enviarLinea("ACK,AUTO," + String(modoAuto ? 1 : 0));
    if (!modoAuto) {               // al apagar el modo auto, apaga su LED
      digitalWrite(LED_AUTO, LOW);
      luzAutoPrev = false;
      enviarLinea("LUZAUTO:0");
    }
    return;
  }

  if (cmd == "PING") {
    enviarLinea("PONG");
    return;
  }

  Serial.print(F("Comando desconocido: "));
  Serial.println(cmd);
}

// ===========================================================================
//  SENSORES
// ===========================================================================
void enviarDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println(F("ERROR_DHT"));
    return;
  }
  enviarLinea("TEMP:" + String(t, 1) + ",HUM:" + String(h, 1));
}

void revisarAgua() {
  int bruto = analogRead(PIN_AGUA);        // 0..1023
  int pct = map(bruto, 0, 1023, 0, 100);
  pct = constrain(pct, 0, 100);
  enviarLinea("AGUA:" + String(pct));

  bool alerta = pct >= AGUA_DESBORDE;
  if (alerta != aguaAlertaPrev) {
    aguaAlertaPrev = alerta;
    enviarLinea("AGUA_ALERTA:" + String(alerta ? 1 : 0));
  }
}

void revisarLDR() {
  int luz = analogRead(PIN_LDR);           // menor = mas oscuro

  // Prioridad "apagar en el punto medio" + histeresis para no parpadear:
  //   - ENCENDER solo si esta claramente oscuro:  luz < (UMBRAL - MARGEN)
  //   - APAGAR en cuanto hay algo de luz:          luz >= UMBRAL
  //   - En la zona media [UMBRAL-MARGEN, UMBRAL) se mantiene el estado
  //     anterior; y si venia apagado, se queda apagado (gana apagar).
  const int MARGEN = 40;
  bool pocaLuz;
  if (luz < (LDR_UMBRAL - MARGEN)) pocaLuz = true;        // claramente oscuro
  else if (luz >= LDR_UMBRAL)      pocaLuz = false;       // hay luz -> apagar
  else                             pocaLuz = ldrPrev;     // zona media: mantener

  if (pocaLuz != ldrPrev) {
    ldrPrev = pocaLuz;
    enviarLinea("LDR:" + String(pocaLuz ? 1 : 0));
  }

  // Modo automatico: el LDR solo gobierna el LED aislado del ultimo piso,
  // NUNCA los 5 LEDs manuales (asi no pelea con los botones de la app).
  if (modoAuto) {
    bool encender = pocaLuz;
    if (encender != luzAutoPrev) {
      luzAutoPrev = encender;
      digitalWrite(LED_AUTO, encender ? HIGH : LOW);
      enviarLinea("LUZAUTO:" + String(encender ? 1 : 0));
    }
  }
}

void revisarPIR() {
  bool mov = digitalRead(PIR_PIN) == HIGH;
  if (mov != pirPrev) {
    pirPrev = mov;
    enviarLinea("PIR:" + String(mov ? 1 : 0));
    // El movimiento tambien enciende el LED automatico brevemente como aviso.
    if (mov) {
      digitalWrite(LED_AUTO, HIGH);
      enviarLinea("LUZAUTO:1");
      luzAutoPrev = true;
    }
  }
}

// ===========================================================================
//  SALIDA (envia por Bluetooth y por el monitor serie)
// ===========================================================================
void enviarLinea(const String &s) {
  // Al Bluetooth: terminamos SOLO con '\n' (sin '\r').
  // El '\r' de println() dejaba un caracter colgando que corrompia el
  // inicio de la linea siguiente (llegaba "MP:" en vez de "TEMP:").
  Serial1.print(s);
  Serial1.print('\n');
  Serial1.flush();            // asegura que la trama salga completa

  // Al monitor serie: println normal, para leerlo comodo.
  Serial.println(s);
}
