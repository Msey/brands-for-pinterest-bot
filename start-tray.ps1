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
$script:allowExit = $false
$script:botProcess = $null

$mutex = New-Object System.Threading.Mutex($false, "Local\TelegramKupimBotTray")
if (-not $mutex.WaitOne(0, $false)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Бот уже работает в трее (рядом с часами). Откройте окно двойным щелчком по иконке.",
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

function Get-SavedCount {
  $file = Join-Path $Root "data\posts.jsonl"
  if (-not (Test-Path -LiteralPath $file)) { return 0 }
  return @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Where-Object { $_.Trim() }).Count
}

function Update-WindowStatus {
  if (-not $script:statusLabel) { return }
  $script:statusLabel.Text = "Статус: $(Get-BotStatus)"
  $script:countLabel.Text = "Сохранено ссылок: $(Get-SavedCount)"
}

function Show-MainWindow {
  Update-WindowStatus
  $script:form.ShowInTaskbar = $true
  if ($script:form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $script:form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  $script:form.Show()
  $script:form.Activate()
  [void]$script:form.BringToFront()
}

function Hide-MainWindow {
  $script:form.Hide()
  $script:form.ShowInTaskbar = $false
}

function Open-DataFolder {
  $data = Join-Path $Root "data"
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  Start-Process explorer.exe -ArgumentList $data
}

function Restart-Bot {
  Start-BotProcess
  Update-WindowStatus
  $script:notify.ShowBalloonTip(3000, "kupim_v_usa", "Бот перезапущен", [System.Windows.Forms.ToolTipIcon]::Info)
}

function Exit-App {
  $script:allowExit = $true
  $script:form.Close()
  [System.Windows.Forms.Application]::Exit()
}

Start-BotProcess

$icon = [System.Drawing.SystemIcons]::Application

$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = "Бот kupim_v_usa"
$script:form.Size = New-Object System.Drawing.Size(440, 260)
$script:form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$script:form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$script:form.MaximizeBox = $false
$script:form.MinimizeBox = $true
$script:form.ShowInTaskbar = $false
$script:form.Icon = $icon
$script:form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$script:statusLabel = New-Object System.Windows.Forms.Label
$script:statusLabel.Location = New-Object System.Drawing.Point(20, 20)
$script:statusLabel.Size = New-Object System.Drawing.Size(380, 24)
$script:statusLabel.Text = "Статус: —"

$script:countLabel = New-Object System.Windows.Forms.Label
$script:countLabel.Location = New-Object System.Drawing.Point(20, 48)
$script:countLabel.Size = New-Object System.Drawing.Size(380, 24)
$script:countLabel.Text = "Сохранено ссылок: 0"

$hintLabel = New-Object System.Windows.Forms.Label
$hintLabel.Location = New-Object System.Drawing.Point(20, 84)
$hintLabel.Size = New-Object System.Drawing.Size(390, 48)
$hintLabel.Text = "Закрытие окна прячет бота в трей. Полностью закрыть можно только через «Выход» в меню иконки."

$btnFolder = New-Object System.Windows.Forms.Button
$btnFolder.Location = New-Object System.Drawing.Point(20, 150)
$btnFolder.Size = New-Object System.Drawing.Size(180, 32)
$btnFolder.Text = "Папка с данными"
$btnFolder.Add_Click({ Open-DataFolder }) | Out-Null

$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Location = New-Object System.Drawing.Point(220, 150)
$btnRestart.Size = New-Object System.Drawing.Size(180, 32)
$btnRestart.Text = "Перезапустить"
$btnRestart.Add_Click({ Restart-Bot }) | Out-Null

$script:form.Controls.Add($script:statusLabel)
$script:form.Controls.Add($script:countLabel)
$script:form.Controls.Add($hintLabel)
$script:form.Controls.Add($btnFolder)
$script:form.Controls.Add($btnRestart)

$script:form.Add_FormClosing({
  param($sender, $e)
  if (-not $script:allowExit) {
    $e.Cancel = $true
    Hide-MainWindow
  }
}) | Out-Null

$script:notify = New-Object System.Windows.Forms.NotifyIcon
$script:notify.Icon = $icon
$script:notify.Visible = $true
$script:notify.Text = "Бот kupim_v_usa"

$menu = New-Object System.Windows.Forms.ContextMenu

$itemOpen = New-Object System.Windows.Forms.MenuItem "Открыть окно"
$itemOpen.Add_Click({ Show-MainWindow }) | Out-Null

$itemFolder = New-Object System.Windows.Forms.MenuItem "Папка с данными"
$itemFolder.Add_Click({ Open-DataFolder }) | Out-Null

$itemRestart = New-Object System.Windows.Forms.MenuItem "Перезапустить"
$itemRestart.Add_Click({ Restart-Bot }) | Out-Null

$itemExit = New-Object System.Windows.Forms.MenuItem "Выход"
$itemExit.Add_Click({ Exit-App }) | Out-Null

[void]$menu.MenuItems.Add($itemOpen)
[void]$menu.MenuItems.Add($itemFolder)
[void]$menu.MenuItems.Add($itemRestart)
[void]$menu.MenuItems.Add("-")
[void]$menu.MenuItems.Add($itemExit)
$script:notify.ContextMenu = $menu

$script:notify.Add_DoubleClick({ Show-MainWindow }) | Out-Null

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({
  if ($script:botProcess -and $script:botProcess.HasExited) {
    $script:botProcess = $null
    $script:notify.ShowBalloonTip(
      4000,
      "kupim_v_usa",
      "Процесс бота остановился. Перезапуск — в меню трея.",
      [System.Windows.Forms.ToolTipIcon]::Warning
    )
  }
  Update-WindowStatus
}) | Out-Null
$timer.Start()

$script:notify.ShowBalloonTip(
  4000,
  "kupim_v_usa",
  "Бот в трее. Двойной щелчок открывает окно, крестик прячет обратно.",
  [System.Windows.Forms.ToolTipIcon]::Info
)

$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
  [System.Windows.Forms.Application]::Run($appContext)
}
finally {
  $timer.Stop()
  $timer.Dispose()
  $script:notify.Visible = $false
  $script:notify.Dispose()
  Stop-BotProcesses
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
