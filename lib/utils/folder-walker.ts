/**
 * Client-Side Recursive Directory Walker & Manifest Builder
 * 
 * Traverses HTML5 webkitdirectory FileList or FileSystemDirectoryHandle entries,
 * generating a structured JSON file tree with byte sizes and checksum manifests.
 */

export interface FileTreeNode {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  selected?: boolean;
}

export function buildDirectoryTree(files: File[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split('/');

    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        existing = {
          id: `node_${Math.random().toString(36).substring(2, 9)}`,
          name: part,
          relativePath: currentPath,
          size: isFile ? file.size : 0,
          type: isFile ? 'file' : 'directory',
          selected: true,
          children: isFile ? undefined : [],
        };
        currentLevel.push(existing);
      }

      if (!isFile) {
        if (!existing.size) existing.size = 0;
        existing.size += file.size;
        currentLevel = existing.children!;
      }
    }
  }

  return root;
}

export function filterSelectedFiles(tree: FileTreeNode[], allFiles: File[]): File[] {
  const selectedPaths = new Set<string>();

  function collectSelected(nodes: FileTreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'file' && node.selected !== false) {
        selectedPaths.add(node.relativePath);
      } else if (node.type === 'directory' && node.children) {
        collectSelected(node.children);
      }
    }
  }

  collectSelected(tree);

  return allFiles.filter((file) => {
    const relPath = file.webkitRelativePath || file.name;
    return selectedPaths.has(relPath);
  });
}

/**
 * Asynchronously recursively extracts all files from HTML5 Drag & Drop event DataTransfer items.
 * Handles single files, multiple files, and nested directories via webkitGetAsEntry.
 */
export async function getAllDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = Array.from(dataTransfer.items || []);
  const entries: any[] = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.() || (item as any).getAsEntry?.();
      if (entry) {
        entries.push(entry);
      } else {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }

  if (entries.length > 0) {
    const readEntry = async (entry: any, path = ''): Promise<void> => {
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file(
            (f: File) => {
              const relPath = path ? `${path}/${f.name}` : f.name;
              Object.defineProperty(f, 'webkitRelativePath', {
                value: relPath,
                writable: true,
                configurable: true,
              });
              files.push(f);
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readAllEntries = async (): Promise<any[]> => {
          const result: any[] = [];
          while (true) {
            const batch: any[] = await new Promise((resolve) =>
              dirReader.readEntries(resolve, () => resolve([]))
            );
            if (!batch || batch.length === 0) break;
            result.push(...batch);
          }
          return result;
        };

        const children = await readAllEntries();
        const currentPath = path ? `${path}/${entry.name}` : entry.name;
        for (const child of children) {
          await readEntry(child, currentPath);
        }
      }
    };

    for (const entry of entries) {
      await readEntry(entry);
    }
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    files.push(...Array.from(dataTransfer.files));
  }

  return files;
}
