import loadGhostscript from "@okathira/ghostpdl-wasm";
import ghostscriptWasmUrl from "@okathira/ghostpdl-wasm/gs.wasm?url";
import loadQpdf from "@neslinesli93/qpdf-wasm";
import qpdfWasmUrl from "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url";

const profiles = {
  balanced: "/ebook",
  strong: "/screen",
  archive: "/printer",
};

let ghostscriptModulePromise;
let qpdfModulePromise;
let activeLogs = null;

self.postMessage({
  type: "engine-status",
  ready: false,
  loading: true,
  message: "Ghostscript WASM 加载中",
});

const postEngineStatus = (ready, message, loading = false) => {
  self.postMessage({
    type: "engine-status",
    ready,
    loading,
    message,
  });
};

const getModule = async () => {
  if (!ghostscriptModulePromise) {
    ghostscriptModulePromise = loadGhostscript({
      locateFile: (path) => (path.endsWith("gs.wasm") ? ghostscriptWasmUrl : path),
      print: (line) => activeLogs?.push(line),
      printErr: (line) => activeLogs?.push(line),
    });
  }

  return ghostscriptModulePromise;
};

const getQpdfModule = async () => {
  if (!qpdfModulePromise) {
    qpdfModulePromise = loadQpdf({
      locateFile: (path) => (path.endsWith("qpdf.wasm") ? qpdfWasmUrl : path),
      print: (line) => activeLogs?.push(line),
      printErr: (line) => activeLogs?.push(line),
    });
  }

  return qpdfModulePromise;
};

const removeFile = (fs, path) => {
  try {
    fs.unlink(path);
  } catch {
    // Ignore cleanup misses in Emscripten's in-memory FS.
  }
};

const toTransferableBuffer = (bytes) => {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer;
  }

  return bytes.slice().buffer;
};

const buildOutputName = (name, profile, optimizeStructure) => {
  const baseName = name.replace(/\.pdf$/i, "");
  return `${baseName}.${profile}${optimizeStructure ? ".qpdf" : ""}.pdf`;
};

const optimizePdfStructure = async ({ id, buffer }) => {
  const qpdf = await getQpdfModule();
  const inputPath = `/qpdf-input-${id}.pdf`;
  const outputPath = `/qpdf-output-${id}.pdf`;

  removeFile(qpdf.FS, inputPath);
  removeFile(qpdf.FS, outputPath);
  qpdf.FS.writeFile(inputPath, new Uint8Array(buffer));

  const exitCode = qpdf.callMain([
    "--object-streams=generate",
    "--compress-streams=y",
    "--decode-level=generalized",
    "--recompress-flate",
    "--compression-level=9",
    inputPath,
    outputPath,
  ]);

  if (exitCode !== 0) {
    const lastLog = activeLogs.slice(-4).join(" ");
    throw new Error(lastLog || `QPDF 退出码 ${exitCode}`);
  }

  const output = qpdf.FS.readFile(outputPath);
  removeFile(qpdf.FS, inputPath);
  removeFile(qpdf.FS, outputPath);
  return toTransferableBuffer(output);
};

const compressPdf = async ({ id, name, buffer, profile, optimizeStructure }) => {
  const Module = await getModule();
  const inputPath = `/input-${id}.pdf`;
  const outputPath = `/output-${id}.pdf`;
  const setting = profiles[profile] ?? profiles.balanced;

  removeFile(Module.FS, inputPath);
  removeFile(Module.FS, outputPath);

  activeLogs = [];
  Module.FS.writeFile(inputPath, new Uint8Array(buffer));

  const exitCode = Module.callMain([
    "-sDEVICE=pdfwrite",
    `-dPDFSETTINGS=${setting}`,
    "-dCompatibilityLevel=1.5",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]);

  if (exitCode !== 0) {
    const lastLog = activeLogs.slice(-4).join(" ");
    throw new Error(lastLog || `Ghostscript 退出码 ${exitCode}`);
  }

  const ghostscriptOutput = Module.FS.readFile(outputPath, { encoding: "binary" });
  removeFile(Module.FS, inputPath);
  removeFile(Module.FS, outputPath);

  const ghostscriptOutputBuffer = toTransferableBuffer(ghostscriptOutput);
  const outputBuffer = optimizeStructure
    ? await optimizePdfStructure({ id, buffer: ghostscriptOutputBuffer })
    : ghostscriptOutputBuffer;

  activeLogs = null;

  return {
    ok: true,
    id,
    buffer: outputBuffer,
    outputName: buildOutputName(name, profile, optimizeStructure),
    message: optimizeStructure
      ? "压缩完成，并已通过 QPDF 重写 PDF 结构。"
      : "压缩完成，文件已在浏览器本地生成。",
  };
};

self.addEventListener("message", async (event) => {
  const message = event.data;

  if (message.type === "probe-engine") {
    try {
      await getModule();
      postEngineStatus(true, "Ghostscript WASM 已就绪");
    } catch (error) {
      postEngineStatus(
        false,
        error instanceof Error ? error.message : "Ghostscript WASM 加载失败"
      );
    }
    return;
  }

  if (message.type !== "compress-pdf") {
    return;
  }

  const port = event.ports[0];

  if (!port) {
    return;
  }

  try {
    const result = await compressPdf(message);
    port.postMessage(result, result.ok ? [result.buffer] : []);
  } catch (error) {
    port.postMessage({
      ok: false,
      id: message.id,
      error: error instanceof Error ? error.message : "PDF Worker 执行失败。",
    });
  } finally {
    activeLogs = null;
  }
});
