# Gorenje-Monitoring-of-Washing-Machines
Long term monitoring of washing machines with ESP32 and low cost sensors

# creating container for postgres
docker run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -d postgres

# example command to run postgres with custom port and password - port mapping from 5432 to 5431
docker run --name Gorenje_postgresql_container -e POSTGRES_PASSWORD=dhm295sxt -p 5431:5432 -d postgres


# Connecting to the database in terminal:
docker exec -it Gorenje_postgresql_container psql -U postgres

