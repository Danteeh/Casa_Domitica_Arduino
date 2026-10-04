/*
 * test_dht.ino  -  Diagnostico del DHT22.
 *
 * Sube esto, abre el Monitor Serie a 9600 y observa:
 *
 *   - Temperatura normal de ambiente: 18-32 grados C aprox.
 *   - Humedad normal: 30-90 % segun el clima.
 *
 * Si la TEMPERATURA sale en 85-90 y no baja, casi seguro es uno de estos:
 *   1) FALTA la resistencia pull-up de 10k entre DATA y VCC (lo mas comun).
 *   2) Cable DATA flojo o muy largo.
 *   3) El sensor es un DHT11 (no DHT22): cambia DHTTYPE a DHT11 abajo.
 *   4) Alimentacion insuficiente: alimenta el DHT a 5V estable.
 *
 * Este sketch tambien imprime la temperatura en Fahrenheit para descartar
 * confusiones: 88 grados C serian 190 F (imposible en ambiente), asi
 * confirmas que 88 NO es "celsius mal convertido a fahrenheit".
 *
 * Cableado DHT22: VCC->5V, DATA->pin 2 (+10k a VCC), GND->GND
 */

#include <DHT.h>

#define DHTPIN  2
#define DHTTYPE DHT22   // <-- cambia a DHT11 si tu sensor es el azul DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  Serial.println("Prueba DHT - leyendo cada 2s");
}

void loop() {
  float h = dht.readHumidity();
  float tC = dht.readTemperature();        // Celsius
  float tF = dht.readTemperature(true);    // Fahrenheit

  if (isnan(h) || isnan(tC)) {
    Serial.println("ERROR: lectura invalida (revisa pull-up 10k y cableado)");
  } else {
    Serial.print("Temp = ");
    Serial.print(tC, 1);
    Serial.print(" C  (");
    Serial.print(tF, 1);
    Serial.print(" F)   Humedad = ");
    Serial.print(h, 1);
    Serial.println(" %");
  }
  delay(2000);
}
