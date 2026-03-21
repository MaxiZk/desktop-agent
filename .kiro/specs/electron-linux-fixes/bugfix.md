# Bugfix Requirements Document

## Introduction

The Electron application in `electron/main.cjs` contains three critical Linux compatibility issues that prevent the application from running on Linux systems. These bugs stem from Windows-specific assumptions about file formats (.ico icons), process spawning (cmd.exe), and error handling for optional dependencies (Ollama). The fixes will ensure the application works seamlessly on both Windows and Linux platforms without crashing when optional services like Ollama are unavailable.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application runs on Linux THEN the system fails to load the tray icon because .ico format is not supported on Linux

1.2 WHEN the application spawns backend or frontend processes on Linux THEN the system crashes with "spawn cmd.exe ENOENT" because cmd.exe does not exist on Linux

1.3 WHEN the application attempts to start Ollama on Linux and Ollama is not installed THEN the system spawns with error "spawn ollama ENOENT" and the error handling does not gracefully continue

### Expected Behavior (Correct)

2.1 WHEN the application runs on Linux THEN the system SHALL use a platform-appropriate icon format (nativeImage.createEmpty() for Linux/Mac, .ico for Windows) for the tray icon without errors

2.2 WHEN the application spawns backend or frontend processes on Linux THEN the system SHALL use npm directly without cmd.exe wrapper, and on Windows SHALL continue using cmd.exe

2.3 WHEN the application attempts to start Ollama and Ollama is not installed THEN the system SHALL catch the error gracefully, log the issue, and continue normal application operation without crashing

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application runs on Windows with .ico icon files THEN the system SHALL CONTINUE TO use icon.ico for both window and tray icons

3.2 WHEN the application spawns processes on Windows THEN the system SHALL CONTINUE TO use cmd.exe with /c flag for npm commands

3.3 WHEN Ollama is already running on any platform THEN the system SHALL CONTINUE TO detect it and skip starting a new instance

3.4 WHEN the application starts successfully THEN the system SHALL CONTINUE TO create the main window, tray, register global shortcuts, and check Ollama status after 3 seconds

3.5 WHEN the user interacts with the tray menu or global shortcuts THEN the system SHALL CONTINUE TO show/hide the window and handle quit operations correctly
