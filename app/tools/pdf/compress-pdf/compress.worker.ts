/// <reference lib="webworker" />

import { PDFDocument } from 'pdf-lib';

/**
 * We use 'self as any' for postMessage to bypass the 
 * DOM vs Worker overload conflict in some TS configurations.
 */
const ctx: Worker = self as any;

ctx.onmessage = async (event: MessageEvent) => {
  const { buffer } = event.data;

  try {
    const pdfDoc = await PDFDocument.load(buffer);

    // Removed 'updateMetadata' as it is no longer in the SaveOptions type
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    // We pass the buffer in the transfer list to avoid memory cloning
    ctx.postMessage({ 
      status: 'success', 
      compressedBytes 
    }, [compressedBytes.buffer] as any);

  } catch (error: any) {
    ctx.postMessage({ status: 'error', message: error.message });
  }
};