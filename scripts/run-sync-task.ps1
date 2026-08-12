# Wrapper invoked by the "MaceooDashboardDailySync" Windows Scheduled Task.
# Ensures Postgres is up, then runs the sync script and logs output.

try {
  & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Users\DEVENDRA\maceoo-pgdata" -l "C:\Users\DEVENDRA\maceoo-pgdata\server.log" -o "-p 5433" start | Out-Null
} catch {}

Set-Location "C:\Users\DEVENDRA\Downloads\Maceoo Dashboard"
$logFile = "C:\Users\DEVENDRA\Downloads\Maceoo Dashboard\scripts\sync.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "`n=== Sync run started $timestamp ==="
& npx tsx scripts/sync.ts *>> $logFile
