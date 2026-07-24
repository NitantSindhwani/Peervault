'use client';

import { useState } from 'react';
import { Folder, FileText, CaretRight, CaretDown, CheckSquare, Square } from '@phosphor-icons/react';
import { FileTreeNode } from '@/lib/utils/folder-walker';
import { formatBytes } from '@/lib/utils/format';

export interface FolderTreeViewerProps {
  nodes: FileTreeNode[];
  onSelectionChange?: (nodes: FileTreeNode[]) => void;
}

export function FolderTreeViewer({ nodes, onSelectionChange }: FolderTreeViewerProps) {
  const [treeData, setTreeData] = useState<FileTreeNode[]>(nodes);

  const toggleNode = (id: string, currentNodes: FileTreeNode[]): FileTreeNode[] => {
    return currentNodes.map((node) => {
      if (node.id === id) {
        const nextState = !node.selected;
        const updatedChildren = node.children
          ? setChildrenSelected(node.children, nextState)
          : undefined;
        return { ...node, selected: nextState, children: updatedChildren };
      }
      if (node.children) {
        return { ...node, children: toggleNode(id, node.children) };
      }
      return node;
    });
  };

  const setChildrenSelected = (children: FileTreeNode[], selected: boolean): FileTreeNode[] => {
    return children.map((c) => ({
      ...c,
      selected,
      children: c.children ? setChildrenSelected(c.children, selected) : undefined,
    }));
  };

  const handleToggle = (id: string) => {
    const next = toggleNode(id, treeData);
    setTreeData(next);
    if (onSelectionChange) onSelectionChange(next);
  };

  return (
    <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 font-mono text-xs max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2 text-[var(--text-secondary)] text-[11px]">
        <span>Directory Structure Slicer</span>
        <span>Toggle Files to Stream</span>
      </div>
      {treeData.map((node) => (
        <TreeNodeItem key={node.id} node={node} onToggle={handleToggle} />
      ))}
    </div>
  );
}

function TreeNodeItem({ node, onToggle }: { node: FileTreeNode; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--bg-surface)] transition-colors">
        {node.type === 'directory' ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {expanded ? <CaretDown className="w-3.5 h-3.5" /> : <CaretRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 h-3.5" />
        )}

        <button
          onClick={() => onToggle(node.id)}
          className="text-[var(--accent)] hover:opacity-80 cursor-pointer flex items-center"
        >
          {node.selected !== false ? (
            <CheckSquare className="w-4 h-4 text-[var(--accent)] font-bold" />
          ) : (
            <Square className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
        </button>

        {node.type === 'directory' ? (
          <Folder className="w-4 h-4 text-amber-400 shrink-0" weight="fill" />
        ) : (
          <FileText className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
        )}

        <span className={`flex-1 truncate ${node.selected === false ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
          {node.name}
        </span>

        <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
          {formatBytes(node.size)}
        </span>
      </div>

      {node.type === 'directory' && expanded && node.children && (
        <div className="pl-5 border-l border-[var(--border-color)]/40 ml-3 space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
