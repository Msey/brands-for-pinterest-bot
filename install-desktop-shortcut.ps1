function Install-KupimDesktopShortcut {
  param([string]$Root = $PSScriptRoot)

  if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.PSCommandPath }
  $vbs = Join-Path $Root "start.vbs"
  $ico = Join-Path $Root "icon.ico"
  if (-not (Test-Path -LiteralPath $vbs)) { return }

  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) { return }

  $lnkPath = Join-Path $desktop "Бот kupim_v_usa.lnk"
  $wscript = Join-Path $env:SystemRoot "System32\wscript.exe"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $wscript
  $shortcut.Arguments = '"' + $vbs + '"'
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = "Локальный Telegram-бот kupim_v_usa"
  if (Test-Path -LiteralPath $ico) {
    $shortcut.IconLocation = $ico + ",0"
  }
  $shortcut.Save()
}

if ($MyInvocation.InvocationName -ne ".") {
  Install-KupimDesktopShortcut
}
