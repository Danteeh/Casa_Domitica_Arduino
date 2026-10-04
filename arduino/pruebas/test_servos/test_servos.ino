/*
 * test_servos.ino  -  Prueba de los dos servomotores.
 *
 * Mueve ambos servos entre 0 (cerrado) y 90 (abierto) cada 2 s, para que
 * ajustes la mecanica de la puerta y el garaje ANTES de montar todo.
 *
 * Si tu puerta necesita otro recorrido, cambia los angulos aqui y luego
 * ponlos iguales en el firmware (funcion que maneja "P,").
 *
 * RECUERDA: alimenta los servos con una fuente 5V EXTERNA y une el GND de esa
 * fuente con el GND del Arduino. No los alimentes del 5V del Arduino.
 *
 * Cableado señal: servo puerta -> pin 10 ; servo garaje -> pin 11
 */

#include <Servo.h>

Servo puerta;
Servo garaje;

void setup() {
  Serial.begin(9600);
  puerta.attach(10);
  garaje.attach(11);
  Serial.println("Prueba servos - abriendo y cerrando cada 2s");
}

void loop() {
  Serial.println("ABRIR (90)");
  puerta.write(90);
  garaje.write(90);
  delay(2000);

  Serial.println("CERRAR (0)");
  puerta.write(0);
  garaje.write(0);
  delay(2000);
}
