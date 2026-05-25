import { useState, useEffect } from 'react';
import axios from 'axios';
import EditorPkg from 'react-simple-code-editor';
import Prism from 'prismjs';
import ReactMarkdown from 'react-markdown';
import { FaTrash, FaEdit, FaPlus, FaSearch, FaSave, FaTimes, FaFolder, FaFolderOpen, FaList, FaCode, FaAlignLeft, FaPlay, FaTerminal } from 'react-icons/fa';
import { UserButton, useAuth } from "@clerk/clerk-react";

// Syntax Highlighting imports
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';

const Editor = EditorPkg.default || EditorPkg;

function App() {
  const [snippets, setSnippets] = useState([]);
  const [folders, setFolders] = useState([]); 
  const [activeFolderId, setActiveFolderId] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [mode, setMode] = useState('create');
  const [selectedSnippet, setSelectedSnippet] = useState(null);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [file, setFile] = useState(null);
  const [snippetFolderId, setSnippetFolderId] = useState(''); 
  const [snippetType, setSnippetType] = useState('code'); 
  
  // Execution State
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { getToken } = useAuth();

  const fetchData = async () => {
    try {
      const token = await getToken();
      const [snippetsRes, foldersRes] = await Promise.all([
        axios.get('/api/snippets', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/folders', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setSnippets(snippetsRes.data);
      setFolders(foldersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const token = await getToken();
      await axios.post('/api/folders', { name: newFolderName }, { headers: { Authorization: `Bearer ${token}` } });
      setNewFolderName('');
      setIsFolderModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation(); 
    if (!window.confirm("Delete folder? Snippets inside will become uncategorized.")) return;
    try {
      const token = await getToken();
      await axios.delete(`/api/folders/${folderId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (activeFolderId === folderId) setActiveFolderId('all');
      fetchData();
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return alert("Title and Content are required!");
    setIsSaving(true);
    let finalImageUrl = selectedSnippet ? selectedSnippet.image_url : null;

    try {
      const token = await getToken();
      if (file && mode === 'create') {
        setStatusMessage('Uploading image...');
        const urlRes = await axios.post('/api/upload-url', { fileName: file.name, fileType: file.type }, { headers: { Authorization: `Bearer ${token}` } });
        await axios.put(urlRes.data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
        finalImageUrl = urlRes.data.publicUrl;
      }

      setStatusMessage('Saving...');
      const payload = { 
        title, 
        code, 
        imageUrl: finalImageUrl, 
        folderId: snippetFolderId === '' ? null : snippetFolderId,
        type: snippetType 
      };

      if (mode === 'edit') {
        await axios.put(`/api/snippets/${selectedSnippet.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post('/api/snippets', payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      resetForm();
      fetchData();
      setStatusMessage('Saved!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setStatusMessage('Error saving snippet.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSnippet = async (id) => {
    if (!window.confirm("Delete snippet?")) return;
    try {
      const token = await getToken();
      await axios.delete(`/api/snippets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (selectedSnippet?.id === id) resetForm();
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  // Execution Handler
  const handleRunCode = async () => {
    const codeToRun = mode === 'view' ? selectedSnippet.code : code;
    if (!codeToRun.trim()) return;
    
    setIsExecuting(true);
    setOutput('Compiling and executing...');
    
    try {
      const token = await getToken();
      const res = await axios.post('/api/execute', {
        source_code: codeToRun,
        language: language
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.error) {
        setOutput(`[ERROR]\n${res.data.error}`);
      } else {
        setOutput(res.data.output || 'Execution finished with no output.');
      }
    } catch (error) {
      setOutput('Failed to reach execution server.');
      console.error(error);
    } finally {
      setIsExecuting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCode('');
    setFile(null);
    setSnippetFolderId(activeFolderId === 'all' || activeFolderId === 'uncategorized' ? '' : activeFolderId);
    setSnippetType('code');
    setOutput('');
    setMode('create');
    setSelectedSnippet(null);
  };

  const openSnippet = (snippet) => {
    setSelectedSnippet(snippet);
    setOutput('');
    setMode('view');
  };

  const editSnippet = () => {
    setTitle(selectedSnippet.title);
    setCode(selectedSnippet.code);
    setSnippetFolderId(selectedSnippet.folder_id || '');
    setSnippetType(selectedSnippet.type || 'code');
    setOutput('');
    setMode('edit');
  };

  const getPrismLanguage = (lang) => {
    if (lang === 'python') return Prism.languages.python;
    if (lang === 'cpp' || lang === 'c') return Prism.languages.cpp;
    return Prism.languages.javascript;
  };

  const displayedSnippets = snippets.filter(s => {
    const matchesFolder = 
      activeFolderId === 'all' ? true :
      activeFolderId === 'uncategorized' ? s.folder_id === null :
      s.folder_id === activeFolderId;
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0e0e11', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      
      {/* LEFT SIDEBAR - FOLDERS */}
      <div style={{ width: '250px', backgroundColor: '#18181c', borderRight: '1px solid #2a2a35', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Vault</h2>
          <UserButton />
        </div>

        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <button onClick={() => setIsFolderModalOpen(true)} style={{ width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#9ca3af', border: '1px dashed #4b5563', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <FaPlus /> New Folder
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div onClick={() => setActiveFolderId('all')} style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: activeFolderId === 'all' ? '#2563eb20' : 'transparent', color: activeFolderId === 'all' ? '#60a5fa' : '#d1d5db', borderRight: activeFolderId === 'all' ? '3px solid #3b82f6' : '3px solid transparent' }}>
             <FaList /> All Items
          </div>
          
          {folders.map(folder => (
            <div key={folder.id} onClick={() => setActiveFolderId(folder.id)} style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: activeFolderId === folder.id ? '#2563eb20' : 'transparent', color: activeFolderId === folder.id ? '#60a5fa' : '#d1d5db', borderRight: activeFolderId === folder.id ? '3px solid #3b82f6' : '3px solid transparent' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {activeFolderId === folder.id ? <FaFolderOpen /> : <FaFolder />}
                  {folder.name}
               </div>
               <button onClick={(e) => handleDeleteFolder(folder.id, e)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0', display: activeFolderId === folder.id ? 'block' : 'none' }}>
                  <FaTrash size={12} />
               </button>
            </div>
          ))}

          <div onClick={() => setActiveFolderId('uncategorized')} style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: activeFolderId === 'uncategorized' ? '#2563eb20' : 'transparent', color: activeFolderId === 'uncategorized' ? '#60a5fa' : '#9ca3af', borderRight: activeFolderId === 'uncategorized' ? '3px solid #3b82f6' : '3px solid transparent' }}>
             <FaList /> Uncategorized
          </div>
        </div>
      </div>

      {/* MIDDLE SIDEBAR - ITEM LIST */}
      <div style={{ width: '300px', backgroundColor: '#131317', borderRight: '1px solid #2a2a35', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px' }}>
          <button onClick={resetForm} style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '15px' }}>
            <FaPlus /> New Item
          </button>

          <div style={{ position: 'relative' }}>
            <FaSearch style={{ position: 'absolute', top: '10px', left: '10px', color: '#6b7280' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 35px', backgroundColor: '#0e0e11', border: '1px solid #2a2a35', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {displayedSnippets.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '20px' }}>No items here.</p>}
          {displayedSnippets.map(snippet => (
            <div 
              key={snippet.id} 
              onClick={() => openSnippet(snippet)}
              style={{ padding: '12px', marginBottom: '8px', backgroundColor: selectedSnippet?.id === snippet.id ? '#2a2a35' : 'transparent', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent', borderColor: selectedSnippet?.id === snippet.id ? '#3b82f6' : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                {snippet.type === 'note' ? <FaAlignLeft color="#10b981" size={12}/> : <FaCode color="#3b82f6" size={12}/>}
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{snippet.title}</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {snippet.code.substring(0, 40)}...
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN STAGE */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#0e0e11', position: 'relative' }}>
        
        {/* VIEW MODE */}
        {mode === 'view' && selectedSnippet && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {selectedSnippet.type === 'note' ? <FaAlignLeft color="#10b981"/> : <FaCode color="#3b82f6"/>}
                  {selectedSnippet.title}
                </h1>
                {selectedSnippet.folder_id && (
                  <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.8rem', backgroundColor: '#374151', padding: '2px 8px', borderRadius: '12px', color: '#d1d5db' }}>
                    <FaFolder style={{ marginRight: '5px', display: 'inline' }}/> 
                    {folders.find(f => f.id === selectedSnippet.folder_id)?.name || 'Unknown'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={editSnippet} style={{ padding: '8px 15px', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> Edit</button>
                <button onClick={() => handleDeleteSnippet(selectedSnippet.id)} style={{ padding: '8px 15px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTrash /> Delete</button>
              </div>
            </div>

            {selectedSnippet.image_url && (
              <div style={{ marginBottom: '30px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2a2a35' }}>
                <img src={selectedSnippet.image_url} alt="Architecture" style={{ width: '100%', display: 'block' }} />
              </div>
            )}

            <div style={{ backgroundColor: '#1e1e24', padding: '30px', borderRadius: '8px', border: '1px solid #2a2a35', marginBottom: '20px' }}>
              {selectedSnippet.type === 'note' ? (
                <div style={{ lineHeight: '1.6', color: '#e5e7eb', fontSize: '1.05rem' }}>
                  <ReactMarkdown>{selectedSnippet.code}</ReactMarkdown>
                </div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", monospace', fontSize: '14px', color: '#e5e7eb' }}>
                  <code>{selectedSnippet.code}</code>
                </pre>
              )}
            </div>

            {/* LIVE EXECUTION TERMINAL (Only for Code) */}
            {selectedSnippet.type === 'code' && (
              <div style={{ backgroundColor: '#131317', border: '1px solid #2a2a35', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#1e1e24', borderBottom: '1px solid #2a2a35' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaTerminal color="#6b7280" />
                    <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontWeight: 'bold' }}>Terminal Output</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', backgroundColor: '#0e0e11', border: '1px solid #374151', color: '#fff', fontSize: '0.85rem' }}
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python 3</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                    </select>
                    <button 
                      onClick={handleRunCode} 
                      disabled={isExecuting}
                      style={{ padding: '6px 15px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: isExecuting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      <FaPlay size={10} /> {isExecuting ? 'Running...' : 'Run Code'}
                    </button>
                  </div>
                </div>
                <div style={{ padding: '15px', minHeight: '120px', backgroundColor: '#0e0e11', color: '#10b981', fontFamily: '"Fira Code", monospace', fontSize: '13px', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                  {output || 'Click "Run Code" to execute snippet...'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CREATE / EDIT MODE */}
        {(mode === 'create' || mode === 'edit') && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h1 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit Item' : 'Create New Item'}</h1>
              {mode === 'edit' && <button onClick={() => setMode('view')} style={{ padding: '8px 15px', background: 'none', color: '#9ca3af', border: '1px solid #374151', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> Cancel</button>}
            </div>

            <form onSubmit={handleSaveSnippet} style={{ backgroundColor: '#18181c', padding: '30px', borderRadius: '12px', border: '1px solid #2a2a35' }}>
              
              {/* TYPE TOGGLE */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#0e0e11', padding: '5px', borderRadius: '8px', width: 'fit-content', border: '1px solid #374151' }}>
                <button type="button" onClick={() => setSnippetType('code')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', backgroundColor: snippetType === 'code' ? '#3b82f6' : 'transparent', color: snippetType === 'code' ? '#fff' : '#9ca3af' }}>
                  <FaCode /> Code Snippet
                </button>
                <button type="button" onClick={() => setSnippetType('note')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', backgroundColor: snippetType === 'note' ? '#10b981' : 'transparent', color: snippetType === 'note' ? '#fff' : '#9ca3af' }}>
                  <FaAlignLeft /> Rich Note
                </button>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder={snippetType === 'code' ? "Algorithm Title" : "Note Title"} 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ flex: 2, padding: '12px', borderRadius: '6px', border: '1px solid #374151', background: '#0e0e11', color: '#fff', fontSize: '1.1rem', boxSizing: 'border-box' }}
                />
                
                <select 
                  value={snippetFolderId} 
                  onChange={(e) => setSnippetFolderId(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #374151', background: '#0e0e11', color: '#fff', fontSize: '1rem', cursor: 'pointer' }}
                >
                  <option value="">-- No Folder --</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* EDITOR SWITCHER */}
              <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#0e0e11', marginBottom: '20px', overflow: 'hidden', minHeight: '300px' }}>
                {snippetType === 'code' ? (
                  <Editor
                    value={code}
                    onValueChange={setCode}
                    highlight={code => Prism.highlight(code, getPrismLanguage(language), language)}
                    padding={15}
                    style={{ fontFamily: '"Fira Code", monospace', fontSize: 14, minHeight: '300px' }}
                  />
                ) : (
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Write your notes here using Markdown! Try # Heading, **bold**, or *italic*..."
                    style={{ width: '100%', minHeight: '300px', padding: '15px', backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                  />
                )}
              </div>

              {mode === 'create' && (
                <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#1e1e24', borderRadius: '6px', border: '1px dashed #374151' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '0.9rem' }}>Attach Architecture Diagram (AWS S3):</label>
                  <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ color: '#fff' }} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button type="submit" disabled={isSaving} style={{ padding: '12px 25px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaSave /> {isSaving ? 'Processing...' : (mode === 'edit' ? 'Save Changes' : `Save ${snippetType === 'code' ? 'Snippet' : 'Note'}`)}
                </button>
                {statusMessage && <span style={{ color: '#60a5fa', fontSize: '0.9rem' }}>{statusMessage}</span>}
              </div>
            </form>
          </div>
        )}

        {/* FOLDER MODAL OVERLAY */}
        {isFolderModalOpen && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ backgroundColor: '#18181c', padding: '25px', borderRadius: '8px', border: '1px solid #374151', width: '300px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>Create New Folder</h3>
              <form onSubmit={handleCreateFolder}>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="e.g., Dynamic Programming" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #374151', background: '#0e0e11', color: '#fff', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setIsFolderModalOpen(false)} style={{ padding: '8px 12px', background: 'none', border: '1px solid #374151', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" style={{ padding: '8px 12px', backgroundColor: '#2563eb', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;