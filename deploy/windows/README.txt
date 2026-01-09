NAVODILA ZA NAMESTITEV IN POSODABLJANJE (WINDOWS)

MAPA: deploy/windows

1. PRVI ZAGON
   ---------------------------------------------------------------
   a) Kopiraj datoteko `.env.example` v `.env`.
   
   b) Odpri odprto datoteko `.env` in nastavi:
      APP_VERSION=... (začetna verzija, npr. v1.0.0)
      POSTGRES_... (gesla za bazo - če je potrebno spremeniti)
      IMAGE_REPO=mihakodric/Gorenje-Monitoring-of-Washing-Machines (če je drugačno, popravi)

   c) Prijavi se v GitHub Container Registry (če so image-i zasebni):
      Odpri PowerShell in vpiši:
      docker login ghcr.io -u <TVOJ_GITHUB_USERNAME>
      (vpiši Personal Access Token kot geslo)

   d) Zaženi aplikacijo:
      Dvoklikni `update.ps1`.

2. POSODOBITEV (UPDATE)
   ---------------------------------------------------------------
   Če želiš posodobiti na novo verzijo (npr. v1.2.3):
   Dvoklikni `update-to-version.ps1` in vpiši tag (npr. v1.2.3).
   
   To bo:
   - Posodobilo .env datoteko.
   - Poneslo nove image-e.
   - Ponovno zagnalo servise.

   Opomba: Če .env že ima pravo verzijo, lahko uporabiš samo `update.ps1`.

3. ROLLBACK (VRAČANJE VERZIJE)
   ---------------------------------------------------------------
   Če nova verzija nagaja, uporabi `rollback.ps1`.
   Vpiši staro verzijo (npr. v1.2.2) in potrdi.

4. LOGI (PREGLED DELOVANJA)
   ---------------------------------------------------------------
   Za pregled logov zaženi `logs.ps1`.

POMEMBNO:
- Baza se hrani v Docker volumnu `timescaledb_data`.
- Konfiguracija Mosquitto je v mapi `mosquitto/config`.
- Ne briši te mape, če želiš ohraniti konfiguracijo deploya.
