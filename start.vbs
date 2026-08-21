Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("Wscript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
sysRoot = sh.ExpandEnvironmentStrings("%SystemRoot%")
ps = Chr(34) & sysRoot & "\System32\WindowsPowerShell\v1.0\powershell.exe" & Chr(34)
args = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & folder & "\start-tray.ps1" & Chr(34)
sh.CurrentDirectory = folder
sh.Run ps & " " & args, 0, False
