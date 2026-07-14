import { BrowserWindow, app, ipcMain, dialog, net } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import {
  registerQuasarRuntime,
  resolveElectronAssetsPath
} from "#q-app/electron/main";

const DB_FILENAME = "mistake-note.db";
const IMAGES_DIR = "images";

function getDbPath(): string {
  return path.join(app.getPath("userData"), DB_FILENAME);
}

function getImagesDir(): string {
  return path.join(app.getPath("userData"), IMAGES_DIR);
}

async function ensureImagesDir() {
  const dir = getImagesDir();
  try { await fs.promises.mkdir(dir, { recursive: true }); } catch { /* ok */ }
}

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

async function registerIpcHandlers() {
  await ensureImagesDir();

  ipcMain.handle("image:save", async (_event, dataUrl: string) => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const buf = Buffer.from(base64, 'base64');
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const name = `${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(getImagesDir(), name);
    await fs.promises.writeFile(filePath, buf);
    return name;
  });

  ipcMain.handle("image:saveAs", async (_event, dataUrl: string, filename: string) => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const buf = Buffer.from(base64, 'base64');
    const filePath = path.join(getImagesDir(), filename);
    await fs.promises.writeFile(filePath, buf);
    return filename;
  });

  ipcMain.handle("image:load", async (_event, name: string) => {
    const filePath = path.join(getImagesDir(), name);
    try {
      const buf = await fs.promises.readFile(filePath);
      const ext = path.extname(name).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch { return null; }
  });

  ipcMain.handle("image:delete", async (_event, name: string) => {
    const filePath = path.join(getImagesDir(), name);
    try { await fs.promises.unlink(filePath); } catch { /* ok */ }
  });

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

  // Dumb HTTPS proxy for AI/OCR calls (renderer → IPC → main → net.request, no CORS).
  ipcMain.handle("ai:request", async (_event, payload: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => {
    const { url, method = "POST", headers = {}, body } = payload;
    if (!/^https:\/\//i.test(url)) {
      throw new Error("仅允许 HTTPS 端点");
    }
    return new Promise((resolve, reject) => {
      const request = net.request({ method, url, headers });
      const timeoutMs = 180000; // 3 minutes
      const timeoutId = setTimeout(() => {
        request.abort();
        const msg = `AI 请求超时（超过 ${timeoutMs / 1000} 秒），请检查网络或稍后重试`;
        console.error('[ai:request] timeout:', url);
        reject(new Error(msg));
      }, timeoutMs);
      let responseBody = '';
      request.on('response', (response) => {
        clearTimeout(timeoutId);
        response.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
        response.on('end', () => {
          console.log('[ai:request] response:', url, response.statusCode, responseBody.slice(0, 100));
          resolve({
            ok: response.statusCode! >= 200 && response.statusCode! < 300,
            status: response.statusCode!,
            statusText: response.statusMessage || '',
            body: responseBody,
          });
        });
      });
      request.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        const isTimeout = /timeout|timed.?out|ETIMEDOUT/i.test(err.message || '');
        const msg = isTimeout
          ? `AI 请求超时（超过 ${timeoutMs / 1000} 秒），请检查网络或稍后重试`
          : `网络错误：${err?.message || String(err)}`;
        console.error('[ai:request] failed:', url, msg);
        reject(new Error(msg));
      });
      if (body) request.write(body);
      request.end();
    });
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
      webSecurity: false,
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
