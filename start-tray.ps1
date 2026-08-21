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

$AppTitle = "Бот kupim_v_usa"
$RecentLimit = 20
$BotJs = Join-Path $Root "bot.js"
$PostsFile = Join-Path $Root "data\posts.jsonl"
$NodeFallback = "C:\Program Files\nodejs\node.exe"

$script:allowExit = $false
$script:botProcess = $null
$script:restarting = $false
$script:consoleNotes = New-Object System.Collections.ArrayList
$script:postLinesCache = @()
$script:postsStamp = $null
$script:timer = $null

$mutex = New-Object System.Threading.Mutex($false, "Local\TelegramKupimBotTray")
if (-not $mutex.WaitOne(0, $false)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Бот уже работает в трее (рядом с часами). Откройте окно двойным щелчком по иконке.",
    $AppTitle,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
  exit 0
}

function Show-AppMessage {
  param(
    [string]$Text,
    [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information
  )
  [System.Windows.Forms.MessageBox]::Show(
    $Text,
    $AppTitle,
    [System.Windows.Forms.MessageBoxButtons]::OK,
    $Icon
  ) | Out-Null
}

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if (Test-Path -LiteralPath $NodeFallback) { return $NodeFallback }
  return $null
}

function Test-OurBotProcess {
  param($ProcessInfo)
  if (-not $ProcessInfo -or -not $ProcessInfo.CommandLine) { return $false }
  $escaped = [regex]::Escape($BotJs)
  return $ProcessInfo.CommandLine -match $escaped
}

function Stop-BotProcesses {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { Test-OurBotProcess $_ } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  if ($script:botProcess -and -not $script:botProcess.HasExited) {
    Stop-Process -Id $script:botProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $script:botProcess = $null
}

function Start-BotProcess {
  param([switch]$SkipStop)
  if (-not $SkipStop) {
    Stop-BotProcesses
  }
  if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) {
      Start-Process -FilePath $npm.Source -ArgumentList "install" -WorkingDirectory $Root -Wait -WindowStyle Hidden
    }
  }
  $node = Get-NodePath
  if (-not $node) {
    Show-AppMessage -Text "Не найден Node.js. Установите его с https://nodejs.org/" -Icon Error
    return $false
  }
  if (-not (Test-Path -LiteralPath $BotJs)) {
    Show-AppMessage -Text "Не найден файл bot.js" -Icon Error
    return $false
  }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = "`"$BotJs`""
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  try {
    $script:botProcess = [System.Diagnostics.Process]::Start($psi)
  }
  catch {
    $script:botProcess = $null
    return $false
  }
  if ($script:botProcess) {
    $script:botProcess.Refresh()
  }
  return [bool]($script:botProcess -and -not $script:botProcess.HasExited)
}

function Get-BotStatus {
  if ($script:restarting) { return "Перезапуск..." }
  if ($script:botProcess) { $script:botProcess.Refresh() }
  if ($script:botProcess -and -not $script:botProcess.HasExited) {
    return "Работает"
  }
  return "Остановлен"
}

function Get-PostLines {
  if (-not (Test-Path -LiteralPath $PostsFile)) {
    $script:postLinesCache = @()
    $script:postsStamp = $null
    return @()
  }
  try {
    $item = Get-Item -LiteralPath $PostsFile
    $stamp = $item.LastWriteTimeUtc.Ticks.ToString() + ":" + $item.Length
    if ($stamp -eq $script:postsStamp) {
      return $script:postLinesCache
    }
    $lines = @(Get-Content -LiteralPath $PostsFile -Encoding UTF8 -ErrorAction Stop | Where-Object { $_.Trim() })
    $script:postLinesCache = $lines
    $script:postsStamp = $stamp
    return $lines
  }
  catch {
    return @($script:postLinesCache)
  }
}

function Get-SavedCount {
  return @(Get-PostLines).Count
}

function Get-RecentPosts {
  $lines = @(Get-PostLines)
  if ($lines.Count -gt $RecentLimit) {
    return $lines[($lines.Count - $RecentLimit)..($lines.Count - 1)]
  }
  return $lines
}

function Update-LogList {
  if (-not $script:logList) { return }
  $items = @(Get-RecentPosts)
  $script:logList.BeginUpdate()
  try {
    $script:logList.Items.Clear()
    if ($items.Count -eq 0) {
      [void]$script:logList.Items.Add("PS> нет сохранённых ссылок")
    }
    else {
      [void]$script:logList.Items.Add("PS data\posts.jsonl>")
      foreach ($line in $items) {
        [void]$script:logList.Items.Add($line)
      }
    }
    foreach ($note in @($script:consoleNotes)) {
      [void]$script:logList.Items.Add($note)
    }
    $maxWidth = [Math]::Max(1, $script:logList.ClientSize.Width)
    try {
      $graphics = $script:logList.CreateGraphics()
      foreach ($entry in $script:logList.Items) {
        $w = [int]$graphics.MeasureString([string]$entry, $script:logList.Font).Width + 24
        if ($w -gt $maxWidth) { $maxWidth = $w }
      }
      $script:logList.HorizontalExtent = $maxWidth
    }
    catch {
      $script:logList.HorizontalExtent = 4000
    }
    finally {
      if ($graphics) { $graphics.Dispose() }
    }
  }
  finally {
    $script:logList.EndUpdate()
  }
  if ($script:logList.Items.Count -gt 0) {
    $script:logList.TopIndex = $script:logList.Items.Count - 1
  }
}

function Update-WindowStatus {
  if (-not $script:statusLabel) { return }
  $script:statusLabel.Text = "Статус: $(Get-BotStatus)"
  $script:countLabel.Text = "Сохранено ссылок: $(Get-SavedCount)"
  Update-LogList
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
  $data = Split-Path -Parent $PostsFile
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  Start-Process explorer.exe -ArgumentList $data
}

function Add-ConsoleNote([string]$text) {
  $time = Get-Date -Format "HH:mm:ss"
  [void]$script:consoleNotes.Add("PS> [$time] $text")
  while ($script:consoleNotes.Count -gt 8) {
    $script:consoleNotes.RemoveAt(0)
  }
}

function Restart-Bot {
  if ($script:restarting) { return }
  $script:restarting = $true
  if ($script:btnRestart) { $script:btnRestart.Enabled = $false }
  try {
    if ($script:statusLabel) {
      $script:statusLabel.Text = "Статус: Перезапуск..."
    }
    Add-ConsoleNote "останавливаю процесс бота..."
    Update-LogList
    [System.Windows.Forms.Application]::DoEvents()

    $oldPid = $null
    if ($script:botProcess -and -not $script:botProcess.HasExited) {
      $oldPid = $script:botProcess.Id
    }
    Stop-BotProcesses
    Start-Sleep -Milliseconds 700
    $ok = Start-BotProcess -SkipStop
    Start-Sleep -Milliseconds 400
    if ($script:botProcess) { $script:botProcess.Refresh() }

    if ($ok -and $script:botProcess -and -not $script:botProcess.HasExited) {
      $msg = "бот перезапущен, PID $($script:botProcess.Id)"
      if ($oldPid) { $msg = "бот перезапущен, PID $oldPid -> $($script:botProcess.Id)" }
      Add-ConsoleNote $msg
    }
    else {
      Add-ConsoleNote "ошибка: процесс bot.js не запустился"
    }
    Update-WindowStatus
    if ($script:notify) {
      $script:notify.ShowBalloonTip(2500, $AppTitle, "Бот перезапущен", [System.Windows.Forms.ToolTipIcon]::Info)
    }
  }
  catch {
    Add-ConsoleNote "ошибка перезапуска: $($_.Exception.Message)"
    Update-LogList
  }
  finally {
    $script:restarting = $false
    if ($script:btnRestart) { $script:btnRestart.Enabled = $true }
  }
}

function Exit-App {
  $script:allowExit = $true
  if ($script:form) { $script:form.Close() }
  [System.Windows.Forms.Application]::Exit()
}

function Get-AppIcon {
  $icoPath = Join-Path $Root "icon.ico"
  if (Test-Path -LiteralPath $icoPath) {
    try {
      return New-Object System.Drawing.Icon -ArgumentList $icoPath
    }
    catch {
      return [System.Drawing.SystemIcons]::Application
    }
  }
  return [System.Drawing.SystemIcons]::Application
}

function Add-TrayMenuItem {
  param($Menu, [string]$Text, $Action)
  $item = New-Object System.Windows.Forms.MenuItem $Text
  if ($Action) { $item.Add_Click($Action) | Out-Null }
  [void]$Menu.MenuItems.Add($item)
}

Start-BotProcess | Out-Null

$script:icon = Get-AppIcon

$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = $AppTitle
$script:form.Size = New-Object System.Drawing.Size(720, 460)
$script:form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$script:form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$script:form.MaximizeBox = $false
$script:form.MinimizeBox = $true
$script:form.ShowInTaskbar = $false
$script:form.Icon = $script:icon
$script:form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$script:statusLabel = New-Object System.Windows.Forms.Label
$script:statusLabel.Location = New-Object System.Drawing.Point(20, 20)
$script:statusLabel.Size = New-Object System.Drawing.Size(660, 24)
$script:statusLabel.Text = "Статус: —"

$script:countLabel = New-Object System.Windows.Forms.Label
$script:countLabel.Location = New-Object System.Drawing.Point(20, 48)
$script:countLabel.Size = New-Object System.Drawing.Size(660, 24)
$script:countLabel.Text = "Сохранено ссылок: 0"

$script:logList = New-Object System.Windows.Forms.ListBox
$script:logList.Location = New-Object System.Drawing.Point(20, 80)
$script:logList.Size = New-Object System.Drawing.Size(660, 270)
$script:logList.IntegralHeight = $false
$script:logList.HorizontalScrollbar = $true
$script:logList.Font = New-Object System.Drawing.Font("Consolas", 9)
$script:logList.BackColor = [System.Drawing.Color]::FromArgb(1, 36, 86)
$script:logList.ForeColor = [System.Drawing.Color]::White
$script:logList.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle

$btnFolder = New-Object System.Windows.Forms.Button
$btnFolder.Location = New-Object System.Drawing.Point(20, 368)
$btnFolder.Size = New-Object System.Drawing.Size(180, 32)
$btnFolder.Text = "Папка с данными"
$btnFolder.Add_Click({ Open-DataFolder }) | Out-Null

$script:btnRestart = New-Object System.Windows.Forms.Button
$script:btnRestart.Location = New-Object System.Drawing.Point(220, 368)
$script:btnRestart.Size = New-Object System.Drawing.Size(180, 32)
$script:btnRestart.Text = "Перезапустить"
$script:btnRestart.Add_Click({ Restart-Bot }) | Out-Null

$script:form.Controls.Add($script:statusLabel)
$script:form.Controls.Add($script:countLabel)
$script:form.Controls.Add($script:logList)
$script:form.Controls.Add($btnFolder)
$script:form.Controls.Add($script:btnRestart)

$script:form.Add_FormClosing({
  param($sender, $e)
  if (-not $script:allowExit) {
    $e.Cancel = $true
    Hide-MainWindow
  }
}) | Out-Null

$script:notify = New-Object System.Windows.Forms.NotifyIcon
$script:notify.Icon = $script:icon
$script:notify.Visible = $true
$script:notify.Text = $AppTitle

$menu = New-Object System.Windows.Forms.ContextMenu
Add-TrayMenuItem $menu "Открыть окно" { Show-MainWindow }
Add-TrayMenuItem $menu "Папка с данными" { Open-DataFolder }
Add-TrayMenuItem $menu "Перезапустить" { Restart-Bot }
[void]$menu.MenuItems.Add("-")
Add-TrayMenuItem $menu "Выход" { Exit-App }
$script:notify.ContextMenu = $menu
$script:notify.Add_DoubleClick({ Show-MainWindow }) | Out-Null

$script:timer = New-Object System.Windows.Forms.Timer
$script:timer.Interval = 3000
$script:timer.Add_Tick({
  if ($script:restarting) { return }
  if ($script:botProcess) { $script:botProcess.Refresh() }
  if ($script:botProcess -and $script:botProcess.HasExited) {
    $script:botProcess = $null
    if ($script:notify) {
      $script:notify.ShowBalloonTip(
        4000,
        $AppTitle,
        "Процесс бота остановился. Перезапуск — в меню трея.",
        [System.Windows.Forms.ToolTipIcon]::Warning
      )
    }
  }
  Update-WindowStatus
}) | Out-Null
$script:timer.Start()

$script:notify.ShowBalloonTip(
  4000,
  $AppTitle,
  "Бот в трее. Двойной щелчок открывает окно, крестик прячет обратно.",
  [System.Windows.Forms.ToolTipIcon]::Info
)

$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
  [System.Windows.Forms.Application]::Run($appContext)
}
finally {
  if ($script:timer) {
    $script:timer.Stop()
    $script:timer.Dispose()
  }
  if ($script:notify) {
    $script:notify.Visible = $false
    $script:notify.Dispose()
  }
  Stop-BotProcesses
  if ($mutex) {
    try { $mutex.ReleaseMutex() } catch { }
    $mutex.Dispose()
  }
}
