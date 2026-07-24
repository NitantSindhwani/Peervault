/**
 * Hardened PeerVault Client-Side Metadata Stripper
 * 
 * Removes EXIF, GPS location, camera model, and author data from
 * images and PDFs in background workers before file encryption.
 */

import piexif from 'piexifjs';
import { PDFDocument } from 'pdf-lib';

export interface MetadataStripReport {
  originalSize: number;
  cleanedSize: number;
  removedFields: string[];
  mimeType: string;
}

/**
 * Strip metadata from an ArrayBuffer based on its MIME type
 */
export async function stripFileMetadata(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<{ cleanedBuffer: ArrayBuffer; report: MetadataStripReport }> {
  const originalSize = buffer.byteLength;
  const removedFields: string[] = [];

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    try {
      const dataUrl = arrayBufferToDataUrl(buffer, 'image/jpeg');
      const cleanDataUrl = piexif.remove(dataUrl);
      const cleanedBuffer = dataUrlToArrayBuffer(cleanDataUrl);
      removedFields.push('JPEG EXIF', 'GPS Location', 'Camera Model/Serial', 'Creation Timestamp');
      return {
        cleanedBuffer,
        report: {
          originalSize,
          cleanedSize: cleanedBuffer.byteLength,
          removedFields,
          mimeType,
        },
      };
    } catch {
      // Fallthrough if parsing fails
      return { cleanedBuffer: buffer, report: { originalSize, cleanedSize: originalSize, removedFields: [], mimeType } };
    }
  }

  if (mimeType.includes('pdf')) {
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));

      const pdfBytes = await pdfDoc.save();
      const cleanedBuffer = pdfBytes.buffer as ArrayBuffer;
      removedFields.push('PDF Author', 'PDF Creator/Producer', 'Subject & Keywords', 'Creation/Modification Dates');

      return {
        cleanedBuffer,
        report: {
          originalSize,
          cleanedSize: cleanedBuffer.byteLength,
          removedFields,
          mimeType,
        },
      };
    } catch {
      return { cleanedBuffer: buffer, report: { originalSize, cleanedSize: originalSize, removedFields: [], mimeType } };
    }
  }

  if (mimeType.includes('png')) {
    try {
      const cleanedBuffer = stripPNGChunks(buffer);
      removedFields.push('PNG tEXt Chunks', 'PNG iTXt Chunks', 'Software/Author Metadata');
      return {
        cleanedBuffer,
        report: {
          originalSize,
          cleanedSize: cleanedBuffer.byteLength,
          removedFields,
          mimeType,
        },
      };
    } catch {
      return { cleanedBuffer: buffer, report: { originalSize, cleanedSize: originalSize, removedFields: [], mimeType } };
    }
  }

  // Non-media file
  return {
    cleanedBuffer: buffer,
    report: {
      originalSize,
      cleanedSize: originalSize,
      removedFields: [],
      mimeType,
    },
  };
}

/**
 * Strip metadata chunks (tEXt, iTXt, zTXt, tIME) from raw PNG ArrayBuffer
 */
function stripPNGChunks(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  // PNG magic number check: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return buffer;
  }

  const result: number[] = [];
  // Keep PNG signature
  for (let i = 0; i < 8; i++) {
    result.push(bytes[i]);
  }

  let offset = 8;
  const view = new DataView(buffer);

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    const chunkTotalLength = 12 + length;

    // Filter metadata chunks
    if (['tEXt', 'iTXt', 'zTXt', 'tIME', 'eXIf'].includes(type)) {
      offset += chunkTotalLength;
      continue;
    }

    // Append chunk bytes
    for (let i = offset; i < offset + chunkTotalLength && i < bytes.length; i++) {
      result.push(bytes[i]);
    }

    offset += chunkTotalLength;
  }

  return new Uint8Array(result).buffer as ArrayBuffer;
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
