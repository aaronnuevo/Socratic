"use client";

import { useEffect, useState, useRef } from 'react';

export default function SynthesizePage() {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('file'); // 'file' or 'directory'
  const [currentDir, setCurrentDir] = useState(null);
  const [dirItems, setDirItems] = useState([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSourceDir, setSelectedSourceDir] = useState(null);
  const [fileContent, setFileContent] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState('source'); // 'source' | 'agent'
  const [synthesizeSession, setSynthesizeSession] = useState(null); // { id, status }
  const [logLines, setLogLines] = useState([]);
  const eventSourceRef = useRef(null);

  // Load persisted state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        // Get current project root
        const dirResponse = await fetch('/api/dir');
        const dirData = await dirResponse.json();
        const currentProjectRoot = dirData.cwd;
        
        // Check if saved data is from the same project
        const savedProjectRoot = localStorage.getItem('socratic:synthesize:projectRoot');
        
        // If project changed, clear all cached data
        if (savedProjectRoot && savedProjectRoot !== currentProjectRoot) {
          console.log('Project changed, clearing cached data');
          localStorage.removeItem('socratic:synthesize:selectedFile');
          localStorage.removeItem('socratic:synthesize:fileContent');
          localStorage.removeItem('socratic:synthesize:selectedSourceDir');
          localStorage.removeItem('socratic:synthesize:session');
          localStorage.removeItem('socratic:synthesize:logs');
          localStorage.removeItem('socratic:synthesize:projectRoot');
        }
        
        // Store current project root
        localStorage.setItem('socratic:synthesize:projectRoot', currentProjectRoot);
        
        const savedFile = localStorage.getItem('socratic:synthesize:selectedFile');
        const savedContent = localStorage.getItem('socratic:synthesize:fileContent');
        const savedSourceDir = localStorage.getItem('socratic:synthesize:selectedSourceDir');
        const savedSession = localStorage.getItem('socratic:synthesize:session');
        const savedLogs = localStorage.getItem('socratic:synthesize:logs');
        
        // Always try to load concepts.txt first to verify it exists
        // This ensures we clear old state if the file doesn't exist in the current project
        const conceptsResponse = await fetch('/api/file?path=concepts.txt');
        if (conceptsResponse.ok) {
          // concepts.txt exists, load it
          const data = await conceptsResponse.json();
          setSelectedFile({ name: 'concepts.txt', path: data.path });
          parseAndSetContent(data.content);
        } else {
          // concepts.txt doesn't exist
          // Only restore saved state if the saved file is NOT concepts.txt
          if (savedFile && savedContent) {
            const fileObj = JSON.parse(savedFile);
            // Only restore if it's not concepts.txt
            if (fileObj.name !== 'concepts.txt') {
              setSelectedFile(fileObj);
              setFileContent(JSON.parse(savedContent));
            }
          }
        }
        
        if (savedSourceDir) {
          setSelectedSourceDir(savedSourceDir);
        }
        if (savedSession) {
          const session = JSON.parse(savedSession);
          setSynthesizeSession(session);
          
          // Restore logs
          if (savedLogs) {
            setLogLines(JSON.parse(savedLogs));
          }
          
          // If session is still running, reconnect to the stream
          if (session.status === 'running') {
            reconnectToSession(session.id);
          }
        }
      } catch (err) {
        console.log('Error loading saved state:', err);
      }
    };
    
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selectedFile when it changes
  useEffect(() => {
    try {
      if (selectedFile) {
        localStorage.setItem('socratic:synthesize:selectedFile', JSON.stringify(selectedFile));
      } else {
        localStorage.removeItem('socratic:synthesize:selectedFile');
      }
    } catch (err) {
      console.log('Error saving selected file:', err);
    }
  }, [selectedFile]);

  // Persist fileContent when it changes
  useEffect(() => {
    try {
      if (fileContent.length > 0) {
        localStorage.setItem('socratic:synthesize:fileContent', JSON.stringify(fileContent));
      } else {
        localStorage.removeItem('socratic:synthesize:fileContent');
      }
    } catch (err) {
      console.log('Error saving file content:', err);
    }
  }, [fileContent]);

  // Persist selectedSourceDir when it changes
  useEffect(() => {
    try {
      if (selectedSourceDir) {
        localStorage.setItem('socratic:synthesize:selectedSourceDir', selectedSourceDir);
      } else {
        localStorage.removeItem('socratic:synthesize:selectedSourceDir');
      }
    } catch (err) {
      console.log('Error saving source directory:', err);
    }
  }, [selectedSourceDir]);

  // Persist synthesize session when it changes
  useEffect(() => {
    try {
      if (synthesizeSession) {
        localStorage.setItem('socratic:synthesize:session', JSON.stringify(synthesizeSession));
      } else {
        localStorage.removeItem('socratic:synthesize:session');
      }
    } catch (err) {
      console.log('Error saving synthesize session:', err);
    }
  }, [synthesizeSession]);

  // Persist log lines when they change
  useEffect(() => {
    try {
      if (logLines.length > 0) {
        localStorage.setItem('socratic:synthesize:logs', JSON.stringify(logLines));
      } else {
        localStorage.removeItem('socratic:synthesize:logs');
      }
    } catch (err) {
      console.log('Error saving logs:', err);
    }
  }, [logLines]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  function ansiToHtml(input) {
    if (!input) return '';
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const colorMap = {
      30: '#000000', 31: '#dc2626', 32: '#16a34a', 33: '#ca8a04', 34: '#2563eb', 35: '#7c3aed', 36: '#0891b2', 37: '#e5e7eb',
      90: '#6b7280', 91: '#ef4444', 92: '#22c55e', 93: '#eab308', 94: '#3b82f6', 95: '#a855f7', 96: '#06b6d4', 97: '#ffffff'
    };
    let html = '';
    let i = 0;
    let openSpan = null; // { color, fontWeight }
    const open = (style) => {
      const parts = [];
      if (style.fontWeight === 'bold') parts.push('font-weight:bold');
      if (style.color) parts.push(`color:${style.color}`);
      html += `<span style="${parts.join(';')}">`;
      openSpan = style;
    };
    const close = () => {
      if (openSpan) {
        html += '</span>';
        openSpan = null;
      }
    };
    const len = input.length;
    while (i < len) {
      const ch = input.charCodeAt(i);
      if (ch === 27 /* ESC */ && i + 1 < len && input[i + 1] === '[') {
        // Parse CSI "\x1b[...m"
        let j = i + 2;
        let codeStr = '';
        while (j < len && input[j] !== 'm') {
          codeStr += input[j++];
        }
        if (j < len && input[j] === 'm') {
          // Apply SGR codes
          const codes = codeStr.split(';').filter(Boolean).map((c) => parseInt(c, 10));
          // Reset default when empty
          if (codes.length === 0) codes.push(0);
          // Build new style
          let nextStyle = openSpan ? { ...openSpan } : { color: null, fontWeight: null };
          for (const code of codes) {
            if (code === 0) { // reset
              nextStyle = { color: null, fontWeight: null };
            } else if (code === 1) { // bold
              nextStyle.fontWeight = 'bold';
            } else if (code >= 30 && code <= 37) {
              nextStyle.color = colorMap[code] || nextStyle.color;
            } else if (code >= 90 && code <= 97) {
              nextStyle.color = colorMap[code] || nextStyle.color;
            } else if (code === 39) { // default fg
              nextStyle.color = null;
            } else if (code === 22) { // normal intensity
              nextStyle.fontWeight = null;
            }
            // Background and extended colors skipped for simplicity
          }
          // If style changed, close/open
          const changed = !openSpan || openSpan.color !== nextStyle.color || openSpan.fontWeight !== nextStyle.fontWeight;
          if (changed) {
            close();
            if (nextStyle.color || nextStyle.fontWeight) open(nextStyle);
          }
          i = j + 1;
          continue;
        }
      }
      // Regular char
      if (input[i] === '\n') {
        html += '\n';
      } else if (input[i] === '\r') {
        // skip carriage return
      } else {
        html += escapeHtml(input[i]);
      }
      i++;
    }
    close();
    return html;
  }

  async function loadConceptsFile() {
    try {
      // Try to load concepts.txt from the project directory
      const response = await fetch('/api/file?path=concepts.txt');
      if (response.ok) {
        const data = await response.json();
        setSelectedFile({ name: 'concepts.txt', path: data.path });
        parseAndSetContent(data.content);
      } else {
        // File doesn't exist - clear any saved state
        setSelectedFile(null);
        setFileContent([]);
      }
    } catch (err) {
      // File doesn't exist or error - clear saved state
      console.log('concepts.txt not found or error loading it');
      setSelectedFile(null);
      setFileContent([]);
    }
  }

  function parseAndSetContent(content) {
    // Parse file content: split into lines and remove empty lines
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setFileContent(lines);
  }

  function openFilePicker() {
    setPickerMode('file');
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

  function openDirPicker() {
    setPickerMode('directory');
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

  function selectCurrentDirectory() {
    if (!currentDir) return;
    setSelectedSourceDir(currentDir);
    setShowPicker(false);
  }

  async function selectFile(item) {
    if (item.isDir) {
      navigateTo(item.path);
      return;
    }
    
    // It's a file, load its content
    setLoadingContent(true);
    try {
      const response = await fetch(`/api/file?path=${encodeURIComponent(item.path)}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedFile(item);
        parseAndSetContent(data.content);
        setShowPicker(false);
      } else {
        alert('Failed to load file');
      }
    } catch (err) {
      alert('Error loading file: ' + err.message);
    } finally {
      setLoadingContent(false);
    }
  }

  function reconnectToSession(sessionId) {
    try {
      // Close previous stream if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      const es = new EventSource(`/api/synthesize/stream?session=${encodeURIComponent(sessionId)}`);
      eventSourceRef.current = es;
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.type === 'log' && typeof payload.line === 'string') {
            setLogLines((prev) => [...prev, payload.line]);
          } else if (payload.type === 'status') {
            setSynthesizeSession((prev) => (prev ? { ...prev, status: payload.status || prev.status } : prev));
          }
        } catch {}
      };
      es.onerror = () => {
        // ignore; connection issues handled by browser EventSource
      };
    } catch (err) {
      console.log('Error reconnecting to session:', err);
    }
  }

  async function startSynthesize() {
    if (!selectedFile || !selectedSourceDir || (synthesizeSession && synthesizeSession.status === 'running')) return;
    try {
      // Close previous stream if any
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      } catch {}
      setLogLines([]);
      const resp = await fetch('/api/synthesize/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputDir: selectedSourceDir,
          keyConceptsFile: selectedFile.path
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to start synthesize');
      const sessionId = data.sessionId;
      setSynthesizeSession({ id: sessionId, status: 'running' });
      setActiveTab('agent');
      reconnectToSession(sessionId);
    } catch (err) {
      setLogLines((prev) => [...prev, `[ERR] ${err?.message || 'Failed to start synthesize'}`]);
    }
  }

  const picker = showPicker ? (
    <div style={styles.modal} onClick={(e) => { if (e.target === e.currentTarget) setShowPicker(false); }}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {pickerMode === 'directory' ? 'Select Directory' : 'Select File'}
          </h2>
          <button onClick={() => setShowPicker(false)} style={styles.closeButton}>×</button>
        </div>
        <div style={styles.pathBar}>
          <button onClick={goUp} style={styles.upButton} disabled={!currentDir || currentDir === '/'}>
            ↑ Up
          </button>
          <span style={styles.currentPath}>{currentDir || '/'}</span>
          {pickerMode === 'directory' && (
            <button onClick={selectCurrentDirectory} style={styles.selectDirButton}>
              Select This Directory
            </button>
          )}
        </div>
        <div style={styles.fileList}>
          {loadingDir ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            dirItems.map((item) => (
              <div
                key={item.path}
                style={styles.fileItem}
                onClick={() => pickerMode === 'file' ? selectFile(item) : item.isDir && navigateTo(item.path)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={styles.fileIcon}>{item.isDir ? '📁' : '📄'}</span>
                <span style={styles.fileName}>{item.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null;

  const canSynthesize = selectedFile && selectedSourceDir;

  return (
    <div>
      <h1>Synthesize</h1>

      <div style={styles.tabsHeader}>
        <button onClick={() => setActiveTab('source')} style={activeTab === 'source' ? styles.tabActive : styles.tab}>Source file</button>
        <button onClick={() => setActiveTab('agent')} style={activeTab === 'agent' ? styles.tabActive : styles.tab}>Agent</button>
      </div>

      {activeTab === 'source' ? (
        <>
          <div style={styles.controls}>
            <button onClick={openFilePicker} style={styles.selectButton}>
              Select File
            </button>
            {selectedFile && (
              <span style={styles.selectedFileLabel}>
                Selected: {selectedFile.name}
              </span>
            )}
          </div>

          <div style={styles.controls}>
            <button onClick={openDirPicker} style={styles.selectButton}>
              Select Source Directory
            </button>
            {selectedSourceDir && (
              <span style={styles.selectedFileLabel}>
                Directory: {selectedSourceDir}
              </span>
            )}
          </div>

          <div style={styles.synthesizeBar}>
            <button
              style={canSynthesize ? styles.synthesizeButton : styles.synthesizeButtonDisabled}
              onClick={startSynthesize}
              disabled={!canSynthesize || (synthesizeSession && synthesizeSession.status === 'running')}
            >
              Synthesize
            </button>
            {synthesizeSession ? (
              <span style={styles.runStatus}>
                {synthesizeSession.status === 'running' ? 'Running…' : synthesizeSession.status === 'exited' ? 'Completed' : synthesizeSession.status}
              </span>
            ) : null}
          </div>

          {loadingContent && (
            <div style={styles.loading}>Loading file content...</div>
          )}

          {!loadingContent && fileContent.length > 0 && (
            <div style={styles.contentArea}>
              <h2 style={styles.contentTitle}>File Content:</h2>
              <ul style={styles.lineList}>
                {fileContent.map((line, index) => (
                  <li key={index} style={styles.lineItem}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {!loadingContent && fileContent.length === 0 && !selectedFile && (
            <div style={styles.emptyMessage}>
              No file selected. Please select a file to view its content.
            </div>
          )}
        </>
      ) : (
        // Agent tab: console only
        <>
          {synthesizeSession ? (
            <div style={styles.logContainer}>
              <div style={styles.logHeader}>
                <span>{synthesizeSession.status === 'running' ? 'Running…' : synthesizeSession.status === 'exited' ? 'Completed' : synthesizeSession.status}</span>
              </div>
              <div style={styles.logBox}>
                <pre style={styles.pre} dangerouslySetInnerHTML={{ __html: ansiToHtml(logLines.join('\n')) }} />
              </div>
            </div>
          ) : (
            <div style={styles.emptyMessage}>
              No synthesis session running. Go to the Source file tab to start one.
            </div>
          )}
        </>
      )}

      {picker}
    </div>
  );
}

const styles = {
  tabsHeader: {
    display: 'flex',
    gap: 8,
    borderBottom: '1px solid #eee',
    marginBottom: 12
  },
  tab: {
    padding: '6px 10px',
    background: '#f3f4f6',
    color: '#111',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer'
  },
  tabActive: {
    padding: '6px 10px',
    background: '#ffffff',
    color: '#111',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer'
  },
  controls: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  synthesizeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  runStatus: {
    color: '#666'
  },
  selectButton: {
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  synthesizeButton: {
    padding: '10px 20px',
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  synthesizeButtonDisabled: {
    padding: '10px 20px',
    backgroundColor: '#d1d5db',
    color: '#6b7280',
    border: 'none',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontSize: '14px',
    fontWeight: '500',
  },
  selectedFileLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },
  contentArea: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  contentTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#1f2937',
  },
  lineList: {
    listStyleType: 'decimal',
    paddingLeft: '30px',
    margin: 0,
  },
  lineItem: {
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#374151',
  },
  emptyMessage: {
    padding: '40px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#6b7280',
  },
  logContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '70vh',
    border: '1px solid #e2e2e2',
    borderRadius: 8,
    overflow: 'hidden'
  },
  logHeader: {
    padding: '8px 12px',
    background: '#fafafa',
    borderBottom: '1px solid #eee',
    fontWeight: 500
  },
  logBox: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  },
  pre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  pathBar: {
    padding: '15px 20px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  upButton: {
    padding: '6px 12px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  selectDirButton: {
    padding: '6px 12px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: 'auto',
  },
  currentPath: {
    fontSize: '14px',
    color: '#374151',
    fontFamily: 'monospace',
  },
  fileList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
  },
  fileItem: {
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background-color 0.15s',
  },
  fileIcon: {
    fontSize: '20px',
  },
  fileName: {
    fontSize: '14px',
    color: '#374151',
  },
};
