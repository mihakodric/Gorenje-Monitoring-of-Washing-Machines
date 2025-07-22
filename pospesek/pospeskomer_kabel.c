#include <Wire.h>

#define LIS2DW12_ADDR 0x19  // I2C naslov senzorja

// Registar za začetek branja pospeškov, na kateri registar hrani
#define OUT_X_L 0x28

void setup() { //void se požene le enkrat
  Serial.begin(115200); //baud rate, kako hitro zajema
  Wire.begin(21, 22);  // SDA, SCL pin

  delay(100);

  // Preverimo WHO_AM_I registar za potrditev komunikacije
  Wire.beginTransmission(LIS2DW12_ADDR); //da začne komunikacijo z napravo s tem naslovom
  Wire.write(0x0F);  // WHO_AM_I registar, registar za prepoznavo
  Wire.endTransmission(); //zaključiš prenos podatkov
  Wire.requestFrom(LIS2DW12_ADDR, 1); //naj naprava pošlje eno vrednost- to bo who am i
  if (Wire.available()) { //če dobimo podatek
    uint8_t whoami = Wire.read(); //ga shrani v whoami, to je 8-bitni integer
    Serial.print("WHO_AM_I = 0x"); //0x da nam je jasno, da je hexa.
    Serial.println(whoami, HEX); //whoami vrednost v hexadecimalnem izpisu
  } else {
    Serial.println("Error reading WHO_AM_I");
  }

  // Nastavimo pospeškomer: ODR 100Hz, obseg ±2g
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x20); //registar za ODR
  Wire.write(0x50);  // 0x50 = 0101 0000 (100Hz)
  Wire.endTransmission();

  // CTRL6 register (0x25) - nastavitev obsega ±2g
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(0x25);  //registar za obseg
  Wire.write(0x00);  // ±2g (default)
  Wire.endTransmission();

  delay(100);
}

void loop() { //izvaja neprekinjeno
  uint8_t data[6]; //spremenljivka data, ki je polje, veliko 6

  // Branje 6 bajtov pospeška X, Y, Z, za vsakega 2 bajta podatkov, skupaj tvorita 16-bitno številko
  Wire.beginTransmission(LIS2DW12_ADDR);
  Wire.write(OUT_X_L | 0x80);  // Postavi MSB za avtomatsko inkrementacijo registra, se pravi da sam bere več zaporednih registrov- brez bi prebral le x, ne pa še y in z
  Wire.endTransmission();
  Wire.requestFrom(LIS2DW12_ADDR, 6); //da pošlje podatke, prva dva sta za x high in low- za večjo natančnost,... in tako dalje

  for (int i = 0; i < 6; i++) { //kot v pythonu, i++ pristeje 1 po vsaki iteraciji
    if (Wire.available()) {
      data[i] = Wire.read(); //nalepi v seznam
    }
  }


  int16_t x = (int16_t)(data[1] << 8 | data[0]); //čisto desno- le formula dveh 8-bitnih števil nazaj v 16-bitno
  int16_t y = (int16_t)(data[3] << 8 | data[2]); // oklepaj pred formulo samo nastavi tip spremenljivke
  int16_t z = (int16_t)(data[5] << 8 | data[4]);

 
  float sensitivity = 0.061 / 1000.0; // v mg/na enoto podatka

  float ax = x * sensitivity;
  float ay = y * sensitivity;
  float az = z * sensitivity;

  Serial.print("X: ");
  Serial.print(ax, 3); //3 pove število decimalnih mest
  Serial.print(" g, Y: ");
  Serial.print(ay, 3);
  Serial.print(" g, Z: ");
  Serial.print(az, 3);
  Serial.println(" g");

  delay(200); //kako pogosto, 1s je 1000
}