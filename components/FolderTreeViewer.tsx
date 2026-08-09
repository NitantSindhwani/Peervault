'use client';

import { useState, useMemo } from 'react';
import {
  Folder,
  FileText,
  CaretRight,
  CaretDown,
  CheckSquare,
  Square,
  MagnifyingGlass,
  Funnel,
  Check,
  X,
} from '@phosphor-icons/react';
import { FileTreeNode } from '@/lib/utils/folder-walker';
import { formatBytes } from '@/lib/utils/format';
import { sfx } from '@/lib/audio/sfx';

export interface FolderTreeViewerProps {
  nodes: FileTreeNode[];
  onSelectionChange?: (nodes: FileTreeNode[]) => void;
}

type FileCategory = 'all' | 'images' | 'videos' | 'docs' | 'code';

export function FolderTreeViewer({ nodes, onSelectionChange }: FolderTreeViewerProps) {
  const [treeData, setTreeData] = useState<FileTreeNode[]>(nodes);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FileCategory>('all');

  const setAllSelectedState = (currentNodes: FileTreeNode[], state: boolean): FileTreeNode[] => {
    return currentNodes.map((node) => ({
      ...node,
      selected: state,
      children: node.children ? setAllSelectedState(node.children, state) : undefined,
    }));
  };

  const handleSelectAll = (state: boolean) => {
    sfx.playToggle();
    const updated = setAllSelectedState(treeData, state);
    setTreeData(updated);
    if (onSelectionChange) onSelectionChange(updated);
  };

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
    sfx.playToggle();
    const next = toggleNode(id, treeData);
    setTreeData(next);
    if (onSelectionChange) onSelectionChange(next);
  };

  // Filter tree nodes based on search & extension categories
  const filteredTreeData = useMemo(() => {
    if (!searchQuery && activeCategory === 'all') return treeData;

    const matchesCategory = (filename: string) => {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (activeCategory === 'images') return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext);
      if (activeCategory === 'videos') return ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext);
      if (activeCategory === 'docs') return ['pdf', 'txt', 'doc', 'docx', 'xlsx', 'md', 'csv'].includes(ext);
      if (activeCategory === 'code') return ['js', 'ts', 'tsx', 'py', 'cpp', 'h', 'html', 'css', 'json', 'dll'].includes(ext);
      return true;
    };

    const filterNodes = (items: FileTreeNode[]): FileTreeNode[] => {
      return items
        .map((item) => {
          if (item.type === 'directory') {
            const filteredChildren = item.children ? filterNodes(item.children) : [];
            if (filteredChildren.length > 0) {
              return { ...item, children: filteredChildren };
            }
          }
          const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCat = matchesCategory(item.name);
          if (matchesQuery && matchesCat) {
            if (item.children) {
              const filteredChildren = filterNodes(item.children);
              return { ...item, children: filteredChildren };
            }
            return item;
          }
          return null;
        })
        .filter(Boolean) as FileTreeNode[];
    };

    return filterNodes(treeData);
  }, [treeData, searchQuery, activeCategory]);

  return (
    <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-4 space-y-3 font-mono text-xs shadow-inner">
      
      {/* Search & Quick Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search files in tree..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Batch Select Buttons */}
        <div className="flex items-center gap-2 text-[11px]">
          <button
            onClick={() => handleSelectAll(true)}
            className="px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="px-2.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Extension Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <Funnel className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mr-1" />
        {(['all', 'images', 'videos', 'docs', 'code'] as FileCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              sfx.playToggle();
              setActiveCategory(cat);
            }}
            className={`px-2.5 py-1 rounded-full capitalize font-semibold cursor-pointer transition-all shrink-0 ${
              activeCategory === cat
                ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tree Item List */}
      <div className="max-h-72 overflow-y-auto space-y-1 pt-1">
        {filteredTreeData.length > 0 ? (
          filteredTreeData.map((node) => (
            <TreeNodeItem key={node.id} node={node} onToggle={handleToggle} />
          ))
        ) : (
          <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
            No files match "{searchQuery}" in category "{activeCategory}".
          </div>
        )}
      </div>
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

        <span className={`flex-1 truncate ${node.selected === false ? 'line-through opacity-50 text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
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
