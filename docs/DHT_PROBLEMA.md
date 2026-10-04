# DHT22 marcando valores imposibles (82 C fijos) - diagnostico

## Que esta pasando

El sensor devuelve una temperatura alta y casi FIJA (82, 76, 77...) con humedad
~10%. Un valor que no cambia con la realidad del cuarto NO es una lectura: es
lo que da el DHT cuando la linea de datos no se comunica bien.

**No es Fahrenheit.** La prueba `test_dht` imprimio "82.4 C (180.3 F)": la
libreria ya entrega Celsius. 82 C no son 82 F mal convertidos; 82 F serian
28 C, pero el valor sube solo (76 -> 77 -> 77.4), lo cual es ruido electrico,
no temperatura. Ademas, al DESCONECTAR el sensor dejo de marcar: eso confirma
que el numero sale del sensor mal conectado, no de una conversion.

Convertir F->C sobre un dato corrupto solo da otro dato corrupto. El arreglo es
fisico.

## Causas, en orden de probabilidad

1. **Falta la resistencia pull-up de 10k ohm entre DATA y VCC.**
   Es la causa numero 1 de lecturas congeladas. El protocolo del DHT necesita
   esa resistencia para que la linea DATA vuelva a nivel alto entre bits.
   - Sensor DHT22 de 4 patas suelto: HAY que ponerla a mano.
   - Modulo DHT22 de 3 patas (placa pequena): ya la trae integrada.

   Conexion:
   ```
   VCC (5V) ----+----[ 10k ]----+
                |               |
              DHT VCC         DHT DATA ---- pin 2 Arduino
   ```

2. **Cable DATA flojo, muy largo, o en el pin equivocado.**
   Debe ir al pin 2. Prueba otro cable y acortalo.

3. **Es un DHT11, no un DHT22.**
   DHT11 = carcasa AZUL, mide 0-50 C. DHT22 = carcasa BLANCA, mide -40..80 C.
   Si tienes un DHT11, en el firmware (casa_domotica.ino) cambia:
   ```c
   #define DHTTYPE DHT22   // -> ponlo en DHT11
   ```

4. **Alimentacion inestable.** Alimenta el DHT a 5V firmes, no desde un pin
   compartido con los servos.

## Como confirmar que quedo bien

Sube `arduino/pruebas/test_dht/test_dht.ino` y mira el Monitor Serie:
- Temperatura entre ~18 y 32 C y que CAMBIE si acercas la mano -> arreglado.
- Si sigue fija en 80 y pico -> el pull-up o el cableado todavia estan mal.

Mientras el sensor de el valor malo, el firmware lo DESCARTA (no manda un dato
falso) y envia `DHT_ERR:1`; la app muestra "err" en temperatura/humedad en vez
de mentir con 82 C.
