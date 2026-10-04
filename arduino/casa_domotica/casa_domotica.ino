/*
 * casa_domotica.ino  -  Firmware mejorado para la prueba minima.
 *
 * MISMO PROTOCOLO que tu version de App Inventor:
 *   App  -> Arduino :  "E,12"  (encender LED 12)   /  "A,12" (apagar LED 12)
 *   Arduino -> App  :  "TEMP:28.5,HUM:44.4"
 *
 * Cambios respecto a tu codigo:
 *   - Parser por LINEAS (readStringUntil) en vez de byte-a-byte con delay(5).
 *     Es inmune a los retrasos del Bluetooth, que es lo que rompia los
 *     comandos cuando llegaban troceados.
 *   - La app Capacitor envia cada comando terminado en '\n', por eso aqui
 *     leemos hasta '\n'.
 *   - Pensado para crecer: anadir comandos nuevos es una linea mas en
 *     procesarComando(), sin tocar el resto.
 *
 * Hardware: Arduino MEGA, HC-05/HC-06 en Serial1, DHT22 en pin 2, LED en 12.
 */

#include <DHT.h>

#define LED_PIN   12
#define DHTPIN    2
#define DHTTYPE   DHT22

DHT dht(DHTPIN, DHTTYPE);

unsigned long tiempoAnterior = 0;
const unsigned long intervaloDHT = 2000;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.begin(9600);    // Monitor serial (depuracion)
  Serial1.begin(9600);   // Bluetooth HC-05 / HC-06

  dht.begin();

  Serial.println(F("Sistema iniciado"));
  Serial.println(F("DHT22 iniciado"));
}

void loop() {
  // 1) Comandos entrantes: una linea completa terminada en '\n'.
  if (Serial1.available()) {
    String linea = Serial1.readStringUntil('\n');
    linea.trim();            // quita espacios y '\r'
    if (linea.length() > 0) {
      Serial.print(F("Recibido: "));
      Serial.println(linea);
      procesarComando(linea);
    }
  }

  // 2) Telemetria DHT22 cada 2 s.
  if (millis() - tiempoAnterior >= intervaloDHT) {
    tiempoAnterior = millis();
    enviarDHT();
  }
}

void procesarComando(const String &cmd) {
  if (cmd == "E,12") {
    digitalWrite(LED_PIN, HIGH);
    Serial1.println(F("LED 12 ENCENDIDO"));
    Serial.println(F("LED 12 ENCENDIDO"));
  }
  else if (cmd == "A,12") {
    digitalWrite(LED_PIN, LOW);
    Serial1.println(F("LED 12 APAGADO"));
    Serial.println(F("LED 12 APAGADO"));
  }
  // --- Aqui se agregan los proximos comandos ---
  // else if (cmd == "S,1") { servo.write(90); ... }   // servo puerta
  // else if (cmd == "PUMP,ON") { ... }                // bomba de agua
  else {
    Serial.print(F("Comando desconocido: "));
    Serial.println(cmd);
  }
}

void enviarDHT() {
  float humedad = dht.readHumidity();
  float temperatura = dht.readTemperature();

  if (isnan(humedad) || isnan(temperatura)) {
    Serial.println(F("ERROR_DHT"));
    return;
  }

  // "TEMP:28.5,HUM:44.4\n"  -> mismo formato que ya parsea la app.
  Serial1.print(F("TEMP:"));
  Serial1.print(temperatura, 1);
  Serial1.print(F(",HUM:"));
  Serial1.println(humedad, 1);

  Serial.print(F("TEMP:"));
  Serial.print(temperatura, 1);
  Serial.print(F(",HUM:"));
  Serial.println(humedad, 1);
}
