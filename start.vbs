Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
ps = Chr(34) & "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" & Chr(34)
args = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & folder & "\start-tray.ps1" & Chr(34)
Set sh = CreateObject("Wscript.Shell")
sh.CurrentDirectory = folder
sh.Run ps & " " & args, 0, False
