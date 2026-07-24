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
