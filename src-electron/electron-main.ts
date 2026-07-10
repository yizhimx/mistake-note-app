import { BrowserWindow, app, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  registerQuasarRuntime,
  resolveElectronAssetsPath
} from "#q-app/electron/main";

const DB_FILENAME = "mistake-note.db";

function getDbPath(): string {
  return path.join(app.getPath("userData"), DB_FILENAME);
}

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

async function registerIpcHandlers() {
  ipcMain.handle("db:read", async () => {
    const dbPath = getDbPath();
    try {
      return await fs.promises.readFile(dbPath);
    } catch {
      return null;
    }
  });

  ipcMain.handle("db:write", async (_event, data: ArrayBuffer) => {
    const dbPath = getDbPath();
    await fs.promises.writeFile(dbPath, Buffer.from(data));
  });

  ipcMain.handle("db:getPath", async () => {
    return getDbPath();
  });

  ipcMain.handle("export:pdf", async (_event, html: string) => {
    const pdfWin = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { contextIsolation: true },
    });
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await pdfWin.webContents.printToPDF({ printBackground: true });
    pdfWin.close();
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "导出错题 PDF",
      defaultPath: `错题报告_${new Date().toISOString().slice(0, 10)}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return false;
    await fs.promises.writeFile(filePath, pdfData);
    return true;
  });
}

async function createWindow() {
  /**
   * Initial window options
   */
  const mainWindow = new BrowserWindow({
    icon: resolveElectronAssetsPath("icons/icon.png"), // linux
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.join(import.meta.dirname, "electron-preload.cjs")
    }
  });

  if (import.meta.env.QUASAR_DEV) {
    await mainWindow.loadURL(import.meta.env.QUASAR_APP_URL);
  } else {
    await mainWindow.loadFile("index.html");
  }

  if (import.meta.env.QUASAR_DEBUG) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }
}

void app.whenReady().then(async () => {
  await registerQuasarRuntime();
  registerIpcHandlers();

  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (platform !== "darwin") {
    app.quit();
  }
});
