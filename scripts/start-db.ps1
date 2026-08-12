# Starts the local Postgres server for this project.
# Run this after a reboot, or any time `psql`/the app can't connect.
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Users\DEVENDRA\maceoo-pgdata" -l "C:\Users\DEVENDRA\maceoo-pgdata\server.log" -o "-p 5433" start
