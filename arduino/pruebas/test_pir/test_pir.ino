/*
 * test_pir.ino  -  Prueba del sensor PIR de movimiento.
 *
 * Sube esto, abre el Monitor Serie a 9600 y muevete frente al sensor.
 * Veras "MOVIMIENTO" cuando detecte y "quieto" cuando no.
 *
 * El PIR tarda ~30-60 s en estabilizarse tras encenderlo: dale ese tiempo
 * antes de confiar en las lecturas. Ajusta los dos potenciometros del modulo
 * (sensibilidad y tiempo de retencion) si da falsos positivos.
 *
 * Cableado: OUT -> pin 3 ; VCC -> 5V ; GND -> GND
 */

#define PIR_PIN 3

void setup() {
  pinMode(PIR_PIN, INPUT);
  Serial.begin(9600);
  Serial.println("Prueba PIR - espera 60s a que se estabilice y muevete");
}

void loop() {
  int v = digitalRead(PIR_PIN);
  Serial.println(v == HIGH ? "MOVIMIENTO" : "quieto");
  delay(300);
}
