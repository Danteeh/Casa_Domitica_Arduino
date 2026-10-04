/*
 * test_ldr.ino  -  Prueba y CALIBRACION del LDR.
 *
 * Sube esto, abre el Monitor Serie a 9600 y mira el valor de A0:
 *   - Tapa el LDR con la mano  -> anota el valor (sera bajo).
 *   - Alumbralo con una linterna -> anota el valor (sera alto).
 * El umbral del firmware (LDR_UMBRAL) debe quedar entre esos dos valores,
 * mas cerca del de "tapado". Por defecto el firmware usa 400.
 *
 * Cableado: 5V -> LDR -> A0 -> 10k -> GND  (ver docs/CONEXIONES.md)
 */

#define PIN_LDR A0

void setup() {
  Serial.begin(9600);
  Serial.println("Prueba LDR - tapa y alumbra el sensor");
}

void loop() {
  int v = analogRead(PIN_LDR);
  Serial.print("LDR A0 = ");
  Serial.print(v);
  Serial.println(v < 400 ? "   (poca luz)" : "   (luz suficiente)");
  delay(500);
}
