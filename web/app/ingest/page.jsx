"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSelectedFiles } from '../selected-files-context';

export default function IngestPage() {
  const [showPicker, setShowPicker] = useState(false);
  const [currentDir, setCurrentDir] = useState(null);
  const [dirItems, setDirItems] = useState([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const { selectedPaths, setSelectedPaths, activePath, setActivePath } = useSelectedFiles();
  const [fileContents, setFileContents] = useState({}); // path -> content
  const [loadingContent, setLoadingContent] = useState(false);

  const hasSelection = selectedPaths.length > 0;

  // selection persistence handled by SelectedFilesProvider

  function openPicker() {
    setShowPicker(true);
    if (!currentDir && !loadingDir) {
      setLoadingDir(true);
      fetch('/api/dir')
        .then((r) => r.json())
        .then((data) => {
          setCurrentDir(data.cwd || '/');
          setDirItems(Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          setCurrentDir('/');
          setDirItems([]);
        })
        .finally(() => setLoadingDir(false));
    }
  }

  function navigateTo(dir) {
    setLoadingDir(true);
    fetch(`/api/dir?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((data) => {
        setCurrentDir(data.cwd || dir);
        setDirItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        // keep currentDir as-is on error
      })
      .finally(() => setLoadingDir(false));
  }

  function goUp() {
    if (!currentDir) return;
    const trimmed = currentDir.replace(/\/+$/, '');
    if (trimmed === '/') return;
    const idx = trimmed.lastIndexOf('/');
    const parent = idx <= 0 ? '/' : trimmed.slice(0, idx);
    navigateTo(parent);
  }

  function togglePath(path) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  }

  function confirmSelection() {
    setShowPicker(false);
    if (selectedPaths.length > 0 && (!activePath || !selectedPaths.includes(activePath))) {
      setActivePath(selectedPaths[0]);
    }
  }

  function cancelSelection() {
    setShowPicker(false);
  }

  useEffect(() => {
    if (!activePath) return;
    if (fileContents[activePath]) return;
    setLoadingContent(true);
    fetch(`/api/file?path=${encodeURIComponent(activePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.content === 'string') {
          setFileContents((prev) => ({ ...prev, [activePath]: data.content }));
        } else {
          setFileContents((prev) => ({ ...prev, [activePath]: '[Unable to display file]' }));
        }
      })
      .catch(() => {
        setFileContents((prev) => ({ ...prev, [activePath]: '[Error loading file]' }));
      })
      .finally(() => setLoadingContent(false));
  }, [activePath, fileContents]);

  const picker = showPicker ? (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goUp} style={styles.buttonSecondary}>Up</button>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444' }}>{currentDir || ''}</span>
          </div>
        </div>
        <div style={styles.modalBody}>
          {loadingDir ? (
            <div>Loading files…</div>
          ) : !dirItems || dirItems.length === 0 ? (
            <div>Empty directory.</div>
          ) : (
            <div style={styles.fileList}>
              {dirItems.map((item) => (
                item.isDir ? (
                  <div key={item.path} style={styles.dirRow} onClick={() => navigateTo(item.path)}>
                    <span style={styles.dirName}>📁 {item.name}</span>
                  </div>
                ) : (
                  <label key={item.path} style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={selectedPaths.includes(item.path)}
                      onChange={() => togglePath(item.path)}
                    />
                    <span style={styles.checkboxLabel}>{item.name}</span>
                  </label>
                )
              ))}
            </div>
          )}
        </div>
        <div style={styles.modalFooter}>
          <button onClick={cancelSelection} style={styles.buttonSecondary}>Cancel</button>
          <button onClick={confirmSelection} style={styles.buttonPrimary}>Select</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <h1>Ingest</h1>
      {!hasSelection ? (
        <div style={styles.emptyPicker} onClick={openPicker}>
          <div>Click to select files</div>
        </div>
      ) : (
        <div style={styles.paneContainer}>
          <div style={styles.leftPane}>
            <div style={styles.leftHeader}>
              <span>Selected files</span>
              <button onClick={openPicker} style={styles.linkButton}>Change</button>
            </div>
            <div style={styles.leftList}>
              {selectedPaths.map((p) => (
                <div
                  key={p}
                  onClick={() => setActivePath(p)}
                  style={p === activePath ? styles.listItemActive : styles.listItem}
                  title={p}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.rightPane}>
            <div style={styles.rightHeader}>{activePath || 'No file selected'}</div>
            <div style={styles.viewer}>
              {activePath ? (
                loadingContent && !fileContents[activePath] ? (
                  <div>Loading…</div>
                ) : (
                  <pre style={styles.pre}>{fileContents[activePath] || ''}</pre>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {picker}
    </div>
  );
}

const styles = {
  emptyPicker: {
    border: '2px dashed #bbb',
    borderRadius: 8,
    padding: 24,
    textAlign: 'center',
    color: '#666',
    cursor: 'pointer'
  },
  paneContainer: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: 16,
    minHeight: 480
  },
  leftPane: {
    border: '1px solid #e2e2e2',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  leftHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    background: '#fafafa'
  },
  leftList: {
    overflow: 'auto'
  },
  listItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  listItemActive: {
    padding: '8px 12px',
    cursor: 'pointer',
    background: '#eef3ff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  rightPane: {
    border: '1px solid #e2e2e2',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  rightHeader: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    background: '#fafafa',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  viewer: {
    height: 520,
    overflow: 'auto',
    padding: 12
  },
  pre: {
    margin: 0,
    whiteSpace: 'pre',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: '#fff',
    borderRadius: 10,
    width: 720,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid #e5e5e5'
  },
  modalHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    background: '#fafafa',
    fontWeight: 600
  },
  modalBody: {
    padding: 16,
    overflow: 'hidden'
  },
  fileList: {
    overflow: 'auto',
    maxHeight: '50vh',
    border: '1px solid #eee',
    borderRadius: 6,
    padding: 8
  },
  dirRow: {
    padding: '6px 4px',
    cursor: 'pointer'
  },
  dirName: {
    fontWeight: 600
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 4px'
  },
  checkboxLabel: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12
  },
  modalFooter: {
    padding: 12,
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    borderTop: '1px solid #eee'
  },
  buttonPrimary: {
    padding: '6px 12px',
    background: '#2b5cff',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer'
  },
  buttonSecondary: {
    padding: '6px 12px',
    background: '#f3f4f6',
    color: '#111',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer'
  },
  linkButton: {
    background: 'transparent',
    border: 'none',
    color: '#2b5cff',
    cursor: 'pointer',
    padding: 0
  }
};


