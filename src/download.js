export const fallbackDownload = (blob, filename) => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

export const saveBlob = async (item) => {
  fallbackDownload(item.outputBlob, item.outputName);
};
