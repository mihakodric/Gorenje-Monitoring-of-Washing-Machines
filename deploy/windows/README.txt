NAVODILA ZA NAMESTITEV IN POSODABLJANJE (WINDOWS)
MAPA: deploy/windows

================================================================

PRVI ZAGON

a) Kopiranje konfiguracijske datoteke
Kopiraj datoteko .env.example in jo preimenuj v .env.

b) Nastavitev konfiguracije
Odpri datoteko .env in preveri oziroma nastavi naslednje vrednosti:

APP_VERSION=...
Začetna verzija aplikacije (npr. v1.0.0)

POSTGRES_...
Gesla in nastavitve za bazo podatkov
(spremeni samo, če je to potrebno)

IMAGE_REPO=mihakodric/Gorenje-Monitoring-of-Washing-Machines
Če uporabljaš drug Docker image repozitorij, to vrednost ustrezno popravi.

c) Prijava v GitHub Container Registry (samo če so Docker image-i zasebni)
Odpri PowerShell in zaženi naslednji ukaz:

docker login ghcr.io -u <TVOJ_GITHUB_USERNAME>

Kot geslo vpiši svoj Personal Access Token za GitHub.

d) Zagon aplikacije
Za zagon aplikacije dvoklikni datoteko:

update.ps1

S tem se bodo prenesli Docker image-i in zagnali vsi servisi.

================================================================

POSODABLJANJE (UPDATE)

Če želiš aplikacijo posodobiti na novo verzijo (npr. v1.2.3):

Dvoklikni datoteko update-to-version.ps1

Ob pozivu vpiši oznako verzije (npr. v1.2.3)

Skripta bo:

posodobila verzijo v datoteki .env,

prenesla nove Docker image-e,

ponovno zagnala vse servise.

Opomba:
Če je v datoteki .env že nastavljena želena verzija, lahko za posodobitev uporabiš samo update.ps1.

================================================================

ROLLBACK (VRAČANJE NA PREJŠNJO VERZIJO)

Če nova verzija ne deluje pravilno:

Dvoklikni rollback.ps1

Vpiši oznako stare verzije (npr. v1.2.2) in potrdi

Sistem se bo vrnil na izbrano prejšnjo verzijo aplikacije.

================================================================

LOGI (PREGLED DELOVANJA)

Za pregled dnevniških zapisov (logov) zaženi:

logs.ps1

================================================================

POMEMBNO

Podatkovna baza se shranjuje v Docker volumenu:
timescaledb_data

Konfiguracija MQTT strežnika Mosquitto se nahaja v mapi:
mosquitto/config

Te mape ne briši, če želiš ohraniti podatke in konfiguracijo obstoječega deploya.