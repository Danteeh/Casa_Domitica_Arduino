/*
 * test_agua.ino  -  Prueba y CALIBRACION del sensor de nivel de agua.
 *
 * Sube esto, abre el Monitor Serie a 9600 y moja el sensor poco a poco:
 *   - Seco           -> anota el valor bruto (cerca de 0).
 *   - Totalmente mojado -> anota el valor bruto (cerca de 1023).
 * Con esos dos numeros ajusta el map() del firmware si el 0-100% no cuadra.
 *
 * Cableado: señal (S) -> A1 ; VCC -> 5V ; GND -> GND
 */

#define PIN_AGUA A1

void setup() {
  Serial.begin(9600);
  Serial.println("Prueba nivel de agua - moja el sensor poco a poco");
}

void loop() {
  int bruto = analogRead(PIN_AGUA);
  int pct = map(bruto, 0, 1023, 0, 100);
  pct = constrain(pct, 0, 100);
  Serial.print("Bruto = ");
  Serial.print(bruto);
  Serial.print("   Nivel = ");
  Serial.print(pct);
  Serial.println(" %");
  delay(500);
}
