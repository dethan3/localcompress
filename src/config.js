export const compressionTimeoutMs = 300000;

export const fileKinds = {
  pdf: {
    mime: "application/pdf",
    extension: ".pdf",
    pickerDescription: "PDF Document",
    compressType: "compress-pdf",
    requiresEngine: true,
    isOffice: false,
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: ".pptx",
    pickerDescription: "PowerPoint Presentation",
    compressType: "compress-office",
    requiresEngine: false,
    isOffice: true,
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
    pickerDescription: "Word Document",
    compressType: "compress-office",
    requiresEngine: false,
    isOffice: true,
  },
};
