Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct KupimTrayRect {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
public class KupimBotWin32 {
  public const int SW_RESTORE = 9;
  const uint WM_MOUSEMOVE = 0x0200;
  const uint SMTO_ABORTIFHUNG = 0x0002;
  const int MaxAxisSteps = 24;
  const int MaxChildren = 16;
  const int MaxPx = 2048;
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
  [DllImport("user32.dll")]
  static extern bool GetClientRect(IntPtr hWnd, ref KupimTrayRect lpRect);
  [DllImport("user32.dll")]
  static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

  public static void RefreshNotificationArea() {
    SweepTrayNotify(FindWindow("Shell_TrayWnd", null));
    SweepTrayNotify(FindWindow("Shell_SecondaryTrayWnd", null));
    SweepToolbars(FindWindow("NotifyIconOverflowWindow", null));
  }

  static void SweepTrayNotify(IntPtr root) {
    if (root == IntPtr.Zero) return;
    IntPtr notify = IntPtr.Zero;
    for (int n = 0; n < MaxChildren; n++) {
      notify = FindWindowEx(root, notify, "TrayNotifyWnd", null);
      if (notify == IntPtr.Zero) return;
      IntPtr pager = IntPtr.Zero;
      bool foundPager = false;
      for (int p = 0; p < MaxChildren; p++) {
        pager = FindWindowEx(notify, pager, "SysPager", null);
        if (pager == IntPtr.Zero) break;
        foundPager = true;
        SweepToolbars(pager);
      }
      if (!foundPager) SweepToolbars(notify);
    }
  }

  static void SweepToolbars(IntPtr parent) {
    if (parent == IntPtr.Zero) return;
    IntPtr toolbar = IntPtr.Zero;
    for (int n = 0; n < MaxChildren; n++) {
      toolbar = FindWindowEx(parent, toolbar, "ToolbarWindow32", null);
      if (toolbar == IntPtr.Zero) return;
      Sweep(toolbar);
    }
  }

  static void Sweep(IntPtr hwnd) {
    KupimTrayRect rect = new KupimTrayRect();
    if (!GetClientRect(hwnd, ref rect)) return;
    int width = rect.Right;
    int height = rect.Bottom;
    if (width <= 0 || height <= 0) return;
    if (width > MaxPx) width = MaxPx;
    if (height > MaxPx) height = MaxPx;
    int stepX = Math.Max(8, (width + MaxAxisSteps - 1) / MaxAxisSteps);
    int stepY = Math.Max(8, (height + MaxAxisSteps - 1) / MaxAxisSteps);
    IntPtr unused;
    for (int x = 0; x <= width; x += stepX) {
      for (int y = 0; y <= height; y += stepY) {
        IntPtr lParam = (IntPtr)unchecked((int)((y << 16) | (x & 0xFFFF)));
        if (SendMessageTimeout(hwnd, WM_MOUSEMOVE, IntPtr.Zero, lParam, SMTO_ABORTIFHUNG, 10, out unused) == IntPtr.Zero) {
          return;
        }
      }
    }
  }
}
"@
$console = [KupimBotWin32]::GetConsoleWindow()
if ($console -ne [IntPtr]::Zero) {
  [void][KupimBotWin32]::ShowWindow($console, 0)
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @"
using System;
using System.Windows.Forms;
public class TrayPopupForm : Form {
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams {
    get {
      CreateParams cp = base.CreateParams;
      cp.ExStyle |= 0x00000080;
      cp.ExStyle |= 0x08000000;
      return cp;
    }
  }
}
"@

$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

$AppTitle = "Бот kupim_v_usa"
try { $Host.UI.RawUI.WindowTitle = $AppTitle } catch { }
$RecentLimit = 20
$BalloonMs = 15000
$MaxFileBytes = 8MB
$MaxDisplayLen = 500
$BotJs = Join-Path $Root "bot.js"
$PostsFile = Join-Path $Root "data\posts.jsonl"
$NodeFallback = "C:\Program Files\nodejs\node.exe"

$script:allowExit = $false
$script:botProcess = $null
$script:restarting = $false
$script:consoleNotes = New-Object System.Collections.ArrayList
$script:postLinesCache = @()
$script:postsStamp = $null
$script:postsCount = 0
$script:knownCount = 0
$script:timer = $null
$script:watcher = $null
$script:watchDebounce = $null
$script:popupForm = $null
$script:popupTimer = $null
$script:popupClick = $null
$script:popupBitmap = $null
$script:fontTitle = $null
$script:fontBody = $null
$script:watchHandler = $null
$script:activateEvent = $null
$script:activateTimer = $null

$MutexName = "Local\TelegramKupimBotTray"
$ActivateEventName = "Local\TelegramKupimBotTrayActivate"

function Update-TrayArea {
  try {
    [KupimBotWin32]::RefreshNotificationArea()
  } catch { }
}

function Restore-ExistingTrayWindow {
  try {
    $ev = [System.Threading.EventWaitHandle]::OpenExisting($ActivateEventName)
    try {
      [void]$ev.Set()
    }
    finally {
      $ev.Close()
    }
  }
  catch { }

  $others = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'start-tray\.ps1' -and $_.ProcessId -ne $PID })
  foreach ($proc in $others) {
    try {
      [void][KupimBotWin32]::AllowSetForegroundWindow([int]$proc.ProcessId)
      $handle = [IntPtr](Get-Process -Id $proc.ProcessId -ErrorAction Stop).MainWindowHandle
      if ($handle -ne [IntPtr]::Zero) {
        [void][KupimBotWin32]::ShowWindow($handle, [KupimBotWin32]::SW_RESTORE)
        [void][KupimBotWin32]::SetForegroundWindow($handle)
        return
      }
    }
    catch { }
  }

  $found = [KupimBotWin32]::FindWindow($null, $AppTitle)
  if ($found -ne [IntPtr]::Zero) {
    [void][KupimBotWin32]::ShowWindow($found, [KupimBotWin32]::SW_RESTORE)
    [void][KupimBotWin32]::SetForegroundWindow($found)
  }
}

$mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0, $false)) {
  Restore-ExistingTrayWindow
  $mutex.Dispose()
  exit 0
}

$script:activateEvent = New-Object System.Threading.EventWaitHandle(
  $false,
  [System.Threading.EventResetMode]::AutoReset,
  $ActivateEventName
)

. (Join-Path $Root "install-desktop-shortcut.ps1")
Install-KupimDesktopShortcut -Root $Root

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

function Get-SafeDisplayLine([string]$line) {
  if ([string]::IsNullOrEmpty($line)) { return "" }
  $clean = [regex]::Replace($line, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u202A-\u202E\u2066-\u2069]', '')
  if ($clean.Length -gt $MaxDisplayLen) {
    return $clean.Substring(0, $MaxDisplayLen) + "..."
  }
  return $clean
}

function Get-PostLines {
  if (-not (Test-Path -LiteralPath $PostsFile)) {
    $script:postLinesCache = @()
    $script:postsStamp = $null
    $script:postsCount = 0
    return @()
  }
  try {
    $item = Get-Item -LiteralPath $PostsFile
    if ($item.Length -gt $MaxFileBytes) {
      $script:postsCount = -1
      $script:postLinesCache = @()
      $script:postsStamp = "oversize:" + $item.Length
      return @()
    }
    $stamp = $item.LastWriteTimeUtc.Ticks.ToString() + ":" + $item.Length
    if ($stamp -eq $script:postsStamp) {
      return $script:postLinesCache
    }
    $count = 0
    $recent = New-Object 'System.Collections.Generic.Queue[string]'
    $stream = [System.IO.File]::Open(
      $PostsFile,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::ReadWrite
    )
    try {
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true)
      try {
        while ($null -ne ($line = $reader.ReadLine())) {
          if ([string]::IsNullOrWhiteSpace($line)) { continue }
          $count++
          $recent.Enqueue((Get-SafeDisplayLine $line))
          if ($recent.Count -gt $RecentLimit) {
            [void]$recent.Dequeue()
          }
        }
      }
      finally {
        $reader.Dispose()
      }
    }
    finally {
      $stream.Dispose()
    }
    $script:postsCount = $count
    $script:postLinesCache = @($recent.ToArray())
    $script:postsStamp = $stamp
    return $script:postLinesCache
  }
  catch {
    return @($script:postLinesCache)
  }
}

function Get-SavedCount {
  if ($null -eq $script:postsCount) { Get-PostLines | Out-Null }
  return $script:postsCount
}

function Get-LastSavedUrl {
  $lines = @(Get-PostLines)
  if ($lines.Count -eq 0) { return $null }
  $last = [string]$lines[-1]
  if ($last -match '"url"\s*:\s*"([^"]+)"') {
    return $Matches[1]
  }
  return $null
}

function Close-TrayPopup {
  if ($script:popupTimer) {
    $script:popupTimer.Stop()
    $script:popupTimer.Dispose()
    $script:popupTimer = $null
  }
  if ($script:popupForm -and -not $script:popupForm.IsDisposed) {
    foreach ($ctrl in @($script:popupForm.Controls)) {
      if ($ctrl -is [System.Windows.Forms.PictureBox]) {
        $ctrl.Image = $null
      }
      $ctrl.Dispose()
    }
    $script:popupForm.Hide()
    $script:popupForm.Dispose()
  }
  $script:popupForm = $null
  $script:popupClick = $null
}

function Show-TrayPopup {
  param(
    [string]$Title,
    [string]$Text,
    [int]$TimeoutMs = 15000,
    [scriptblock]$OnClick
  )
  Close-TrayPopup
  $script:popupClick = $OnClick
  $Title = Get-SafeDisplayLine $Title
  $Text = Get-SafeDisplayLine $Text

  $form = New-Object TrayPopupForm
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $form.ShowInTaskbar = $false
  $form.TopMost = $true
  $form.Size = New-Object System.Drawing.Size(380, 108)
  $form.BackColor = [System.Drawing.Color]::FromArgb(45, 45, 48)
  $form.Cursor = [System.Windows.Forms.Cursors]::Hand

  $work = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $form.Location = New-Object System.Drawing.Point(
    ($work.Right - $form.Width - 10),
    ($work.Bottom - $form.Height - 10)
  )

  $click = {
    if ($script:popupClick) { & $script:popupClick }
    Close-TrayPopup
  }

  if ($script:icon) {
    $pic = New-Object System.Windows.Forms.PictureBox
    $pic.Size = New-Object System.Drawing.Size(32, 32)
    $pic.Location = New-Object System.Drawing.Point(12, 14)
    $pic.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
    $pic.Image = Get-PopupBitmap
    $pic.Cursor = [System.Windows.Forms.Cursors]::Hand
    $pic.Add_Click($click)
    $form.Controls.Add($pic)
  }

  $titleLabel = New-Object System.Windows.Forms.Label
  $titleLabel.Location = New-Object System.Drawing.Point(52, 10)
  $titleLabel.Size = New-Object System.Drawing.Size(290, 22)
  $titleLabel.ForeColor = [System.Drawing.Color]::White
  $titleLabel.Font = $script:fontTitle
  $titleLabel.Text = $Title
  $titleLabel.Cursor = [System.Windows.Forms.Cursors]::Hand
  $titleLabel.Add_Click($click)
  $form.Controls.Add($titleLabel)

  $bodyLabel = New-Object System.Windows.Forms.Label
  $bodyLabel.Location = New-Object System.Drawing.Point(52, 34)
  $bodyLabel.Size = New-Object System.Drawing.Size(300, 62)
  $bodyLabel.ForeColor = [System.Drawing.Color]::FromArgb(220, 220, 220)
  $bodyLabel.Font = $script:fontBody
  $bodyLabel.Text = $Text
  $bodyLabel.Cursor = [System.Windows.Forms.Cursors]::Hand
  $bodyLabel.Add_Click($click)
  $form.Controls.Add($bodyLabel)

  $closeBtn = New-Object System.Windows.Forms.Label
  $closeBtn.Text = "x"
  $closeBtn.Location = New-Object System.Drawing.Point(354, 4)
  $closeBtn.Size = New-Object System.Drawing.Size(22, 22)
  $closeBtn.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
  $closeBtn.ForeColor = [System.Drawing.Color]::Silver
  $closeBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
  $closeBtn.Add_Click({ Close-TrayPopup })
  $form.Controls.Add($closeBtn)

  $form.Add_Click($click)
  $script:popupForm = $form
  $script:popupTimer = New-Object System.Windows.Forms.Timer
  $script:popupTimer.Interval = [Math]::Max(1000, $TimeoutMs)
  $script:popupTimer.Add_Tick({ Close-TrayPopup })
  $script:popupTimer.Start()
  $form.Show()
}

function Show-NewLinkBalloon {
  param([int]$Added = 1)
  $url = Get-LastSavedUrl
  if ($Added -le 1 -and $url) {
    $text = "$url`nНажмите, чтобы открыть папку с базой."
  }
  else {
    $text = "Сохранено ссылок: $Added`nНажмите, чтобы открыть папку с базой."
  }
  Show-TrayPopup -Title "Новая ссылка" -Text $text -TimeoutMs $BalloonMs -OnClick { Open-DataFolder }
}

function Check-NewPosts {
  $previous = $script:knownCount
  Get-PostLines | Out-Null
  $count = Get-SavedCount
  $added = 0
  if ($count -ge 0 -and $previous -ge 0 -and $count -gt $previous) {
    $added = $count - $previous
  }
  $script:knownCount = $count
  if ($added -gt 0 -and -not $script:restarting) {
    Show-NewLinkBalloon $added
  }
}

function Update-LogList {
  if (-not $script:logList) { return }
  $items = @(Get-PostLines)
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
  $count = Get-SavedCount
  if ($count -lt 0) {
    $script:countLabel.Text = "Сохранено ссылок: файл слишком большой"
  }
  else {
    $script:countLabel.Text = "Сохранено ссылок: $count"
  }
  if (Test-MainWindowOpen) {
    Update-LogList
  }
}

function Test-MainWindowOpen {
  return [bool](
    $script:form -and
    -not $script:form.IsDisposed -and
    $script:form.Visible -and
    $script:form.WindowState -eq [System.Windows.Forms.FormWindowState]::Normal
  )
}

function Show-MainWindow {
  $script:form.ShowInTaskbar = $true
  if ($script:form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
    $script:form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  }
  $script:form.Show()
  Update-WindowStatus
  $script:form.Activate()
  [void]$script:form.BringToFront()
  $hwnd = $script:form.Handle
  if ($hwnd -ne [IntPtr]::Zero) {
    [void][KupimBotWin32]::ShowWindow($hwnd, [KupimBotWin32]::SW_RESTORE)
    [void][KupimBotWin32]::SetForegroundWindow($hwnd)
  }
}

function Hide-MainWindow {
  $script:form.ShowInTaskbar = $true
  $script:form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
  if (-not $script:form.Visible) {
    $script:form.Show()
  }
}

function Open-DataFolder {
  $data = Split-Path -Parent $PostsFile
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  $full = [System.IO.Path]::GetFullPath($data)
  $rootFull = [System.IO.Path]::GetFullPath($Root)
  $prefix = $rootFull.TrimEnd('\') + '\'
  if (-not ($full.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase))) {
    return
  }
  Start-Process explorer.exe -ArgumentList $full
}

function Add-ConsoleNote([string]$text) {
  $time = Get-Date -Format "HH:mm:ss"
  [void]$script:consoleNotes.Add("PS> [$time] $(Get-SafeDisplayLine $text)")
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
    Show-TrayPopup -Title $AppTitle -Text "Бот перезапущен" -TimeoutMs 2500
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
      return New-Object System.Drawing.Icon -ArgumentList $icoPath, 32, 32
    }
    catch { }
  }
  return [System.Drawing.SystemIcons]::Application
}

function Get-PopupBitmap {
  if ($script:popupBitmap) { return $script:popupBitmap }

  $pngPath = Join-Path $Root "icon.png"
  if (Test-Path -LiteralPath $pngPath) {
    $bytes = [System.IO.File]::ReadAllBytes($pngPath)
    $stream = New-Object System.IO.MemoryStream(,$bytes)
    try {
      $source = [System.Drawing.Image]::FromStream($stream)
      try {
        $bmp = New-Object System.Drawing.Bitmap 32, 32
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        try {
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.DrawImage($source, 0, 0, 32, 32)
        }
        finally {
          $graphics.Dispose()
        }
        $script:popupBitmap = $bmp
      }
      finally {
        $source.Dispose()
      }
    }
    finally {
      $stream.Dispose()
    }
    return $script:popupBitmap
  }

  if ($script:icon) {
    $script:popupBitmap = $script:icon.ToBitmap()
  }
  return $script:popupBitmap
}

function Add-TrayMenuItem {
  param($Menu, [string]$Text, $Action)
  $item = New-Object System.Windows.Forms.MenuItem $Text
  if ($Action) { $item.Add_Click($Action) | Out-Null }
  [void]$Menu.MenuItems.Add($item)
}

Start-BotProcess | Out-Null

$script:icon = Get-AppIcon
$script:fontTitle = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$script:fontBody = New-Object System.Drawing.Font("Segoe UI", 9)

$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = $AppTitle
$script:form.Size = New-Object System.Drawing.Size(720, 460)
$script:form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$script:form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$script:form.MaximizeBox = $false
$script:form.MinimizeBox = $true
$script:form.ShowInTaskbar = $true
$script:form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
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
$script:notify.Text = $AppTitle
Update-TrayArea
$script:notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenu
Add-TrayMenuItem $menu "Открыть окно" { Show-MainWindow }
Add-TrayMenuItem $menu "Папка с данными" { Open-DataFolder }
Add-TrayMenuItem $menu "Перезапустить" { Restart-Bot }
[void]$menu.MenuItems.Add("-")
Add-TrayMenuItem $menu "Выход" { Exit-App }
$script:notify.ContextMenu = $menu
$script:notify.Add_DoubleClick({ Show-MainWindow }) | Out-Null

Get-PostLines | Out-Null
$script:knownCount = Get-SavedCount

$dataDir = Split-Path -Parent $PostsFile
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$null = $script:form.Handle

$script:activateTimer = New-Object System.Windows.Forms.Timer
$script:activateTimer.Interval = 200
$script:activateTimer.Add_Tick({
  if ($script:activateEvent -and $script:activateEvent.WaitOne(0)) {
    Show-MainWindow
  }
}) | Out-Null
$script:activateTimer.Start()

$script:watchDebounce = New-Object System.Windows.Forms.Timer
$script:watchDebounce.Interval = 400
$script:watchDebounce.Add_Tick({
  $script:watchDebounce.Stop()
  Check-NewPosts
  Update-WindowStatus
}) | Out-Null

$script:watcher = New-Object System.IO.FileSystemWatcher
$script:watcher.Path = $dataDir
$script:watcher.Filter = "posts.jsonl"
$script:watcher.IncludeSubdirectories = $false
$script:watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::Size -bor [System.IO.NotifyFilters]::FileName
$script:watcher.SynchronizingObject = $script:form
$script:watchHandler = {
  $script:watchDebounce.Stop()
  $script:watchDebounce.Start()
}
$script:watcher.add_Changed($script:watchHandler)
$script:watcher.add_Created($script:watchHandler)
$script:watcher.EnableRaisingEvents = $true

$script:timer = New-Object System.Windows.Forms.Timer
$script:timer.Interval = 3000
$script:timer.Add_Tick({
  if ($script:restarting) { return }
  if ($script:botProcess) { $script:botProcess.Refresh() }
  if ($script:botProcess -and $script:botProcess.HasExited) {
    $script:botProcess = $null
    if ($script:notify) {
      Show-TrayPopup -Title $AppTitle -Text "Процесс бота остановился. Перезапуск — в меню трея." -TimeoutMs 8000
    }
  }
  Check-NewPosts
  Update-WindowStatus
}) | Out-Null
$script:timer.Start()

Hide-MainWindow
Show-TrayPopup -Title $AppTitle -Text "Бот в трее. Двойной щелчок по иконке открывает окно." -TimeoutMs 4000

$appContext = New-Object System.Windows.Forms.ApplicationContext
try {
  [System.Windows.Forms.Application]::Run($appContext)
}
finally {
  if ($script:popupTimer -or $script:popupForm) {
    Close-TrayPopup
  }
  if ($script:activateTimer) {
    $script:activateTimer.Stop()
    $script:activateTimer.Dispose()
  }
  if ($script:activateEvent) {
    $script:activateEvent.Dispose()
    $script:activateEvent = $null
  }
  if ($script:watchDebounce) {
    $script:watchDebounce.Stop()
    $script:watchDebounce.Dispose()
  }
  if ($script:watcher) {
    $script:watcher.EnableRaisingEvents = $false
    if ($script:watchHandler) {
      $script:watcher.remove_Changed($script:watchHandler)
      $script:watcher.remove_Created($script:watchHandler)
    }
    $script:watcher.Dispose()
  }
  if ($script:timer) {
    $script:timer.Stop()
    $script:timer.Dispose()
  }
  if ($script:notify) {
    $script:notify.Visible = $false
    $script:notify.Dispose()
    $script:notify = $null
    Update-TrayArea
  }
  if ($script:popupBitmap) {
    $script:popupBitmap.Dispose()
    $script:popupBitmap = $null
  }
  if ($script:fontTitle) { $script:fontTitle.Dispose() }
  if ($script:fontBody) { $script:fontBody.Dispose() }
  Stop-BotProcesses
  if ($mutex) {
    try { $mutex.ReleaseMutex() } catch { }
    $mutex.Dispose()
  }
}
