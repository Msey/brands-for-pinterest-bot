Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KupimBotWin32 {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$console = [KupimBotWin32]::GetConsoleWindow()
if ($console -ne [IntPtr]::Zero) {
  [void][KupimBotWin32]::ShowWindow($console, 0)
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

$mutex = New-Object System.Threading.Mutex($false, "Local\TelegramKupimBotTray")
if (-not $mutex.WaitOne(0, $false)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Бот уже работает в трее (рядом с часами).",
    "kupim_v_usa",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
  exit 0
}

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = "C:\Program Files\nodejs\node.exe"
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  return $null
}

function Stop-BotProcesses {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'bot\.js') } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  if ($script:botProcess -and -not $script:botProcess.HasExited) {
    Stop-Process -Id $script:botProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $script:botProcess = $null
}

function Start-BotProcess {
  Stop-BotProcesses
  if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) {
      Start-Process -FilePath $npm.Source -ArgumentList "install" -WorkingDirectory $Root -Wait -WindowStyle Hidden
    }
  }
  $node = Get-NodePath
  if (-not $node) {
    [System.Windows.Forms.MessageBox]::Show(
      "Не найден Node.js. Установите его с https://nodejs.org/",
      "kupim_v_usa",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    return
  }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = "bot.js"
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $script:botProcess = [System.Diagnostics.Process]::Start($psi)
}

function Get-BotStatus {
  if ($script:botProcess -and -not $script:botProcess.HasExited) {
    return "Работает"
  }
  return "Остановлен"
}

$script:botProcess = $null
Start-BotProcess

$icon = [System.Drawing.SystemIcons]::Application
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = $icon
$notify.Visible = $true
$notify.Text = "Бот kupim_v_usa"

$menu = New-Object System.Windows.Forms.ContextMenu

$itemStatus = New-Object System.Windows.Forms.MenuItem "Статус"
$itemStatus.Add_Click({
  $notify.ShowBalloonTip(
    4000,
    "kupim_v_usa",
    (Get-BotStatus),
    [System.Windows.Forms.ToolTipIcon]::Info
  )
}) | Out-Null

$itemFolder = New-Object System.Windows.Forms.MenuItem "Папка с данными"
$itemFolder.Add_Click({
  $data = Join-Path $Root "data"
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  Start-Process explorer.exe -ArgumentList $data
}) | Out-Null

$itemRestart = New-Object System.Windows.Forms.MenuItem "Перезапустить"
$itemRestart.Add_Click({
  Start-BotProcess
  $notify.ShowBalloonTip(3000, "kupim_v_usa", "Бот перезапущен", [System.Windows.Forms.ToolTipIcon]::Info)
}) | Out-Null

$itemExit = New-Object System.Windows.Forms.MenuItem "Выход"
$itemExit.Add_Click({
  [System.Windows.Forms.Application]::Exit()
}) | Out-Null

[void]$menu.MenuItems.Add($itemStatus)
[void]$menu.MenuItems.Add($itemFolder)
[void]$menu.MenuItems.Add($itemRestart)
[void]$menu.MenuItems.Add("-")
[void]$menu.MenuItems.Add($itemExit)
$notify.ContextMenu = $menu

$notify.Add_DoubleClick({
  $notify.ShowBalloonTip(
    4000,
    "kupim_v_usa",
    (Get-BotStatus) + ". Правый клик — меню.",
    [System.Windows.Forms.ToolTipIcon]::Info
  )
}) | Out-Null

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({
  if ($script:botProcess -and $script:botProcess.HasExited) {
    $script:botProcess = $null
    $notify.ShowBalloonTip(
      4000,
      "kupim_v_usa",
      "Процесс бота остановился. Перезапуск — в меню трея.",
      [System.Windows.Forms.ToolTipIcon]::Warning
    )
  }
}) | Out-Null
$timer.Start()

$notify.ShowBalloonTip(
  4000,
  "kupim_v_usa",
  "Бот в трее, окно скрыто. Правый клик по иконке — меню.",
  [System.Windows.Forms.ToolTipIcon]::Info
)

$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
  [System.Windows.Forms.Application]::Run($appContext)
}
finally {
  $timer.Stop()
  $timer.Dispose()
  $notify.Visible = $false
  $notify.Dispose()
  Stop-BotProcesses
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
