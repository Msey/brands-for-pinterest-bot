# Скрывает консоль и держит бота в трее. Не закрывается после запуска.
$tray = Join-Path $PSScriptRoot "start-tray.ps1"
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
Start-Process -FilePath $ps -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-STA",
  "-ExecutionPolicy", "Bypass",
  "-File", $tray
)
