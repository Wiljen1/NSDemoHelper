@echo off
setlocal

rem Compatibility launcher. The main Windows helper entry point is
rem start-helper-windows.bat, kept separate from the PowerShell runtime.
call "%~dp0start-helper-windows.bat" %*
