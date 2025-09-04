# Gravity Analog AC Current Sensor (SKU: SEN0211)

Website: [Gravity_Analog_AC_Current_Sensor](https://wiki.dfrobot.com/Gravity_Analog_AC_Current_Sensor__SKU_SEN0211_)

## Pin Connections (Sensor → ESP32)

- VCC (Red wire) → 3.3V  
- GND (Black wire) → GND  
- Signal (Blue wire) → GPIO 34

## Notes

- Only clamp the AC transformer probe to **one AC wire**.  
- Analog output is compatible with **3.3V microcontrollers**. 


<img src="SEN0211_connection_attention.png" alt="Alt text" width="400">


opombe: če hočemo, lahko uporabimo še LEDico, da preverimo, če deluje, v tem primeru jo lahko vežemo na enega od pinov, ali pa je že vgrajena 
(možno da na pin2), in samo zamenjamo pina 2 in 13 v kodi (pojasnjeno z komentarji v kodi)

