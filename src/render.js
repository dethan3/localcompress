import { fileKinds } from "./config.js";
import { state, engineStatus, structureToggle, queueSummary, fileList, compressButton, rowTemplate } from "./state.js";
import { formatBytes, getKindConfig, getItemById, canProcessItem, createClearedResultPatch, createFailedItemPatch, isBinaryOutput, isOfficeKind } from "./utils.js";

export const setEngineStatus = (label, tone = "") => {
  engineStatus.textContent = label;
  engineStatus.className = `status-chip${tone ? ` ${tone}` : ""}`;
};

export const setStructureToggleEnabled = (enabled) => {
  structureToggle.disabled = !enabled;
  if (!enabled) {
    structureToggle.checked = false;
  }
  structureToggle.closest(".checkbox-field")?.classList.toggle("disabled-field", !enabled);
};

export const updateSummary = () => {
  const totalBytes = state.files.reduce((sum, item) => sum + item.file.size, 0);
  queueSummary.innerHTML = `
    <span>${state.files.length} 个文件</span>
    <span>总计 ${formatBytes(totalBytes)}</span>
  `;
};

export const renderEmptyState = () => {
  const emptyRow = document.createElement("li");
  emptyRow.className = "empty-row";
  emptyRow.textContent = "队列为空。当前接受 PDF、PPTX 和 DOCX 文件，支持一次加入多个文件。";
  fileList.appendChild(emptyRow);
};

export const renderItem = (item) => {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".file-row");
  const name = fragment.querySelector(".file-name");
  const size = fragment.querySelector(".file-size");
  const badge = fragment.querySelector(".file-badge");
  const message = fragment.querySelector(".file-message");
  const download = fragment.querySelector(".download-link");

  name.textContent = item.file.name;
  size.textContent = item.resultBytes
    ? `${formatBytes(item.file.size)} -> ${formatBytes(item.resultBytes)}`
    : formatBytes(item.file.size);
  badge.textContent = item.statusLabel;
  badge.className = `file-badge ${item.tone}`;
  message.textContent = item.message;

  if (item.tone === "success" && item.outputBlob) {
    download.hidden = false;
    download.dataset.fileId = item.id;
    download.textContent = "下载文件";
  }

  row.dataset.fileId = item.id;
  fileList.appendChild(fragment);
};

export const renderFiles = () => {
  fileList.textContent = "";

  if (state.files.length === 0) {
    renderEmptyState();
  }

  state.files.forEach(renderItem);
  updateSummary();
  compressButton.disabled =
    state.isProcessing || state.files.length === 0 || !state.files.some((item) => canProcessItem(item));
};

export const markItem = (id, patch) => {
  const item = getItemById(id);
  if (!item) {
    return;
  }

  Object.assign(item, patch);
  renderFiles();
};

export const buildProcessingMessage = (item, profile, optimizeStructure, currentIndex, totalCount) => {
  if (isOfficeKind(item.kind)) {
    return `JSZip 正在解包 ${item.kind.toUpperCase()}（${currentIndex}/${totalCount}），并按 ${profile} 档位重压缩图片。`;
  }

  if (optimizeStructure) {
    return `Ghostscript 压缩后将执行 QPDF 结构优化（${currentIndex}/${totalCount}），使用 ${profile} 档位。`;
  }

  return `Ghostscript WASM 正在处理（${currentIndex}/${totalCount}），使用 ${profile} 档位。`;
};

export const markItemPreparing = (item, profile, optimizeStructure, currentIndex, totalCount) => {
  markItem(item.id, {
    statusLabel: "压缩中",
    tone: "processing",
    message: buildProcessingMessage(item, profile, optimizeStructure, currentIndex, totalCount),
    ...createClearedResultPatch(),
  });
};

export const markItemSuccess = (item, result) => {
  if (!isBinaryOutput(result.buffer)) {
    markItem(item.id, createFailedItemPatch("压缩结果无效，未收到可保存的输出文件。"));
    return;
  }

  const blob = new Blob([result.buffer], {
    type: getKindConfig(item.kind)?.mime ?? fileKinds.pdf.mime,
  });

  markItem(item.id, {
    statusLabel: "已完成",
    tone: "success",
    message: result.message,
    resultBytes: blob.size,
    outputName: result.outputName,
    outputBlob: blob,
  });
};
