import JSZip from 'jszip';

export interface ZipProgressCallback {
  (percent: number, currentFile: string): void;
}

/**
 * Hardened PeerVault Client-Side Lossless Zip Archiver Engine
 * 
 * Compresses multiple loose files or full directory trees into a real, bit-for-bit
 * lossless .zip archive file directly inside the browser using WebAssembly / JSZip.
 */
export async function archiveFilesToZip(
  files: File[],
  onProgress?: ZipProgressCallback,
  customZipName?: string
): Promise<File> {
  const zip = new JSZip();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Preserve relative directory paths for nested folders if webkitRelativePath exists
    const relativePath = file.webkitRelativePath || file.name;
    
    if (onProgress) {
      const stepPercent = Math.round(((i + 1) / files.length) * 40);
      onProgress(stepPercent, `Reading ${file.name}...`);
    }

    const arrayBuffer = await file.arrayBuffer();
    zip.file(relativePath, arrayBuffer);
  }

  // Generate lossless ZIP Blob with DEFLATE compression level 6
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        const genPercent = 40 + Math.round(metadata.percent * 0.6);
        onProgress(genPercent, `Compressing ZIP (${metadata.percent.toFixed(0)}%)...`);
      }
    }
  );

  let zipFileName = customZipName;
  if (!zipFileName) {
    const relativePath = files[0]?.webkitRelativePath;
    if (relativePath && relativePath.includes('/')) {
      zipFileName = `${relativePath.split('/')[0]}.zip`;
    } else {
      const firstName = files[0]?.name.replace(/\.[^/.]+$/, '') || 'archive';
      zipFileName = files.length === 1 
        ? `${firstName}.zip` 
        : `${firstName}_and_${files.length - 1}_other_files.zip`;
    }
  }

  return new File([zipBlob], zipFileName, { type: 'application/zip' });
}
