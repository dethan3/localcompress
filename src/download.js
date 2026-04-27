import { fileKinds } from "./config.js";
import { getKindConfig } from "./utils.js";

export const getPickerTypes = (item) => {
  const config = getKindConfig(item.kind) ?? fileKinds.pdf;
  return [
    {
      description: config.pickerDescription,
      accept: {
        [config.mime]: [config.extension],
      },
    },
  ];
};

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
  if (!("showSaveFilePicker" in window)) {
    fallbackDownload(item.outputBlob, item.outputName);
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: item.outputName,
    types: getPickerTypes(item),
  });
  const writable = await handle.createWritable();
  await writable.write(item.outputBlob);
  await writable.close();
};
