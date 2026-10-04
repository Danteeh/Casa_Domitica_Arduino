# Conexiones fisicas - Casa Domotica (Arduino MEGA 2560)

Documento de cableado. Cada seccion dice en que pin va cada cosa y como
conectarla. Al final hay una tabla resumen y la lista de materiales.

> Regla general de LEDs: cada LED lleva una resistencia de **220 ohm** en serie
> (pata larga/anodo al pin de Arduino a traves... no: el pin de Arduino ->
> resistencia -> anodo del LED -> catodo del LED -> GND).

---

## 1. Modulo Bluetooth HC-05 / HC-06  (Serial1)

| HC-05 | Arduino MEGA | Nota |
|-------|--------------|------|
| VCC   | 5V           | |
| GND   | GND          | |
| TXD   | RX1 = pin 19 | directo (el HC-05 saca 3.3V, el MEGA lo lee bien) |
| RXD   | TX1 = pin 18 | **con divisor de tension** (ver abajo) |

**Divisor de tension para RXD** (el MEGA manda 5V y el HC-05 espera 3.3V):

```
TX1 (pin 18) ----[ 1k ohm ]----+---- RXD (HC-05)
                               |
                            [ 2k ohm ]
                               |
                              GND
```

Sin el divisor el HC-05 funciona un tiempo pero se degrada. Ponlo.

---

## 2. Sensor DHT22 (temperatura / humedad)

| DHT22 | Arduino | Nota |
|-------|---------|------|
| VCC (pin 1) | 5V | |
| DATA (pin 2)| pin 2 (digital) | resistencia **10k** entre DATA y VCC (pull-up) |
| (pin 3) | sin conectar | |
| GND (pin 4) | GND | |

---

## 3. Sensor PIR (movimiento)

| PIR | Arduino | Nota |
|-----|---------|------|
| VCC | 5V | |
| OUT | pin 3 (digital) | salida digital: HIGH cuando hay movimiento |
| GND | GND | |

El PIR tiene dos potenciometros: uno ajusta la sensibilidad y otro el tiempo
que mantiene la salida en HIGH tras detectar. Ajustalos a mano.

---

## 4. Sensor LDR (luz) - entrada analogica A0

El LDR es una resistencia que varia con la luz. Se usa en divisor de tension:

```
5V ----[ LDR ]----+---- A0
                  |
              [ 10k ohm ]
                  |
                 GND
```

- Con **mucha luz** el LDR baja su resistencia -> A0 sube.
- Con **poca luz** el LDR sube su resistencia -> A0 baja.

En el firmware, `LDR_UMBRAL = 400`: por debajo de ese valor analogico se
considera "poca luz". **Ajusta ese numero** midiendo tu LDR real (ver el sketch
de prueba `test_ldr.ino`).

---

## 5. Sensor de nivel de agua - entrada analogica A1

Sensor tipo tira de pistas (el comun y barato):

| Sensor agua | Arduino | Nota |
|-------------|---------|------|
| + (VCC) | 5V | mejor alimentarlo solo al medir para que no se corroa |
| - (GND) | GND | |
| S (señal) | A1 | 0..1023 segun cuanta tira esta mojada |

El firmware convierte 0..1023 a 0..100 %. Calibra con el tanque real: anota el
valor con el tanque vacio y lleno y ajusta el `map()` si hace falta.

---

## 6. LEDs manuales (5) + LED automatico (1)

Cada LED: `pin -> resistencia 220 ohm -> anodo(+) LED -> catodo(-) LED -> GND`.

| LED | Nombre en la app | Pin |
|-----|------------------|-----|
| LED1 | Sala           | 4 |
| LED2 | Cocina         | 5 |
| LED3 | Habitacion 1   | 6 |
| LED4 | Habitacion 2   | 7 |
| LED5 | Pasillo        | 8 |
| LED auto | Luz automatica (ultimo piso) | 9 |

El LED del pin 9 es el que gobierna el LDR en modo automatico; es
independiente de los 5 manuales.

---

## 7. Servomotores (2)

| Servo | Funcion | Señal (naranja) | VCC (rojo) | GND (marron) |
|-------|---------|-----------------|------------|--------------|
| Servo 1 | Puerta principal | pin 10 | 5V externo | GND comun |
| Servo 2 | Garaje          | pin 11 | 5V externo | GND comun |

**IMPORTANTE sobre la alimentacion de los servos:**
- NO alimentes los servos desde el 5V del Arduino: dan picos de corriente que
  reinician la placa. Usa una **fuente externa de 5V** (p. ej. un cargador o un
  modulo con pilas) para el rojo de los dos servos.
- **Une el GND de esa fuente con el GND del Arduino** (masa comun), si no, el
  servo no entiende la señal.
- Angulos en el firmware: `0 grados = cerrado`, `90 grados = abierto`. Cambialos
  en la funcion que maneja `P,` dentro del `.ino` si tu mecanica necesita otros.

---

## Tabla resumen de pines

| Pin | Uso |
|-----|-----|
| 2 | DHT22 DATA |
| 3 | PIR OUT |
| 4 | LED1 Sala |
| 5 | LED2 Cocina |
| 6 | LED3 Habitacion 1 |
| 7 | LED4 Habitacion 2 |
| 8 | LED5 Pasillo |
| 9 | LED automatico (LDR) |
| 10 | Servo puerta principal |
| 11 | Servo garaje |
| 18 (TX1) | HC-05 RXD (con divisor) |
| 19 (RX1) | HC-05 TXD |
| A0 | LDR (divisor con 10k) |
| A1 | Nivel de agua (señal) |
| 5V / GND | alimentacion sensores |

## Lista de materiales

- 1x Arduino MEGA 2560
- 1x modulo Bluetooth HC-05 (o HC-06)
- 1x DHT22
- 1x sensor PIR (HC-SR501 tipico)
- 1x LDR + 1x resistencia 10k
- 1x sensor de nivel de agua analogico
- 6x LED (5 manuales + 1 automatico) + 6x resistencia 220 ohm
- 2x servomotor (SG90 para maquetas; MG995 si mueven peso)
- 1x resistencia 10k (pull-up DHT22)
- 2x resistencia para el divisor del HC-05 (1k y 2k, o 2x1k en serie)
- fuente externa 5V para los servos
- protoboard y cables
