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

// Track ongoing AI requests for cancellation
const ongoingAiRequests = new Map<string, {
  request: ReturnType<typeof net.request>;
  overallTimeoutId: NodeJS.Timeout;
  settled: { value: boolean };
}>();

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
    requestId?: string;
  }) => {
    const { url, method = "POST", headers = {}, body, requestId } = payload;
    if (!/^https:\/\//i.test(url)) {
      throw new Error("仅允许 HTTPS 端点");
    }
    return new Promise((resolve, reject) => {
      const request = net.request({ method, url, headers });
      const overallTimeoutMs = 180000; // 整个请求含 body 的上限（非流式响应下 headers 在生成完成后才到达）
      // 用对象共享 settled，使 ai:cancel 能标记结算，避免 abort 触发 error 时二次 reject
      const settledRef = { value: false };
      const settle = (fn: () => void) => {
        if (settledRef.value) return;
        settledRef.value = true;
        fn();
      };

      // 单一整体超时：仅在响应体接收完成（end）或出错（error）时清除，
      // 绝不在 response（响应头）时清除——非流式响应下 response 在模型生成完毕后才触发，
      // 若在此清除则慢模型/大图请求会无限挂起；连接失败由 error 事件快速 reject，无需独立连接超时。
      const overallTimeoutId = setTimeout(() => {
        settle(() => {
          request.abort();
          if (requestId) ongoingAiRequests.delete(requestId);
          console.error('[ai:request] timeout:', url);
          reject(new Error(`AI 请求超时（超过 ${overallTimeoutMs / 1000} 秒），请检查网络或稍后重试`));
        });
      }, overallTimeoutMs);

      // Track request for cancellation (survives into the body phase)
      if (requestId) {
        ongoingAiRequests.set(requestId, { request, overallTimeoutId, settled: settledRef });
      }

      let responseBody = '';
      request.on('response', (response) => {
        // 整体超时继续守护 body 传输，不在此清除
        response.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
        response.on('end', () => {
          settle(() => {
            clearTimeout(overallTimeoutId);
            if (requestId) ongoingAiRequests.delete(requestId);
            console.log('[ai:request] response:', url, response.statusCode, responseBody.slice(0, 100));
            resolve({
              ok: response.statusCode! >= 200 && response.statusCode! < 300,
              status: response.statusCode!,
              statusText: response.statusMessage || '',
              body: responseBody,
            });
          });
        });
      });
      request.on('error', (err: Error) => {
        settle(() => {
          clearTimeout(overallTimeoutId);
          if (requestId) ongoingAiRequests.delete(requestId);
          const isTimeout = /timeout|timed.?out|ETIMEDOUT/i.test(err.message || '');
          const msg = isTimeout
            ? `AI 请求超时（超过 ${overallTimeoutMs / 1000} 秒），请检查网络或稍后重试`
            : `网络错误：${err?.message || String(err)}`;
          console.error('[ai:request] failed:', url, msg);
          reject(new Error(msg));
        });
      });
      if (body) request.write(body);
      request.end();
    });
  });

  // Cancel an ongoing AI request by requestId
  ipcMain.handle("ai:cancel", async (_event, requestId: string) => {
    const entry = ongoingAiRequests.get(requestId);
    if (entry) {
      clearTimeout(entry.overallTimeoutId);
      entry.settled.value = true; // 标记已结算，避免 abort 触发 error 时二次 reject
      entry.request.abort();
      ongoingAiRequests.delete(requestId);
      console.log('[ai:cancel] aborted request:', requestId);
      return { success: true };
    }
    console.warn('[ai:cancel] request not found:', requestId);
    return { success: false, reason: 'not_found' };
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
