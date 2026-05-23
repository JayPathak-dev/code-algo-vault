import { useState, useEffect } from 'react';
import axios from 'axios';
import EditorPkg from 'react-simple-code-editor';
import Prism from 'prismjs';
import { FaTrash, FaEdit, FaPlus, FaSearch, FaSave, FaTimes } from 'react-icons/fa';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/themes/prism-tomorrow.css';

const Editor = EditorPkg.default || EditorPkg;

function App() {
  const [snippets, setSnippets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // App State: 'view', 'create', 'edit'
  const [mode, setMode] = useState('create');
  const [selectedSnippet, setSelectedSnippet] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('// Paste your algorithm here...\n');
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchSnippets = async () => {
    try {
      const response = await axios.get('/api/snippets');
      setSnippets(response.data);
    } catch (error) {
      console.error("Error fetching snippets:", error);
    }
  };

  useEffect(() => {
    fetchSnippets();
  }, []);

  // --- CRUD OPERATIONS ---

  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return alert("Title and Code are required!");
    setIsSaving(true);
    let finalImageUrl = selectedSnippet ? selectedSnippet.image_url : null;

    try {
      if (file && mode === 'create') {
        setStatusMessage('Uploading image to AWS S3...');
        const urlRes = await axios.post('/api/upload-url', { fileName: file.name, fileType: file.type });
        await axios.put(urlRes.data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
        finalImageUrl = urlRes.data.publicUrl;
      }

      setStatusMessage('Saving to PostgreSQL Database...');
      
      if (mode === 'edit') {
        await axios.put(`/api/snippets/${selectedSnippet.id}`, { title, code });
      } else {
        await axios.post('/api/snippets', { title, code, imageUrl: finalImageUrl });
      }
      
      resetForm();
      fetchSnippets();
      setStatusMessage('Saved successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setStatusMessage('Error saving snippet.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this snippet?")) return;
    try {
      await axios.delete(`/api/snippets/${id}`);
      if (selectedSnippet?.id === id) resetForm();
      fetchSnippets();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  // --- UI HELPERS ---

  const resetForm = () => {
    setTitle('');
    setCode('// Paste your algorithm here...\n');
    setFile(null);
    setMode('create');
    setSelectedSnippet(null);
  };

  const openSnippet = (snippet) => {
    setSelectedSnippet(snippet);
    setMode('view');
  };

  const editSnippet = () => {
    setTitle(selectedSnippet.title);
    setCode(selectedSnippet.code);
    setMode('edit');
  };

  const filteredSnippets = snippets.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0e0e11', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '300px', backgroundColor: '#18181c', borderRight: '1px solid #2a2a35', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '20px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Vault <span style={{ fontSize: '0.8rem', background: '#3b82f6', padding: '2px 8px', borderRadius: '12px' }}>{snippets.length}</span>
          </h2>
          
          <button onClick={resetForm} style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '15px' }}>
            <FaPlus /> New Snippet
          </button>

          <div style={{ position: 'relative' }}>
            <FaSearch style={{ position: 'absolute', top: '10px', left: '10px', color: '#6b7280' }} />
            <input 
              type="text" 
              placeholder="Search vault..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 35px', backgroundColor: '#0e0e11', border: '1px solid #2a2a35', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {filteredSnippets.map(snippet => (
            <div 
              key={snippet.id} 
              onClick={() => openSnippet(snippet)}
              style={{ padding: '12px', marginBottom: '8px', backgroundColor: selectedSnippet?.id === snippet.id ? '#2a2a35' : 'transparent', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s', border: '1px solid transparent', borderColor: selectedSnippet?.id === snippet.id ? '#3b82f6' : 'transparent' }}
            >
              <h4 style={{ margin: '0 0 5px 0', fontSize: '0.95rem' }}>{snippet.title}</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {snippet.code.substring(0, 40)}...
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN STAGE */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#0e0e11' }}>
        
        {/* VIEW MODE */}
        {mode === 'view' && selectedSnippet && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>{selectedSnippet.title}</h1>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={editSnippet} style={{ padding: '8px 15px', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaEdit /> Edit</button>
                <button onClick={() => handleDelete(selectedSnippet.id)} style={{ padding: '8px 15px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTrash /> Delete</button>
              </div>
            </div>

            {selectedSnippet.image_url && (
              <div style={{ marginBottom: '30px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2a2a35' }}>
                <img src={selectedSnippet.image_url} alt="Architecture" style={{ width: '100%', display: 'block' }} />
              </div>
            )}

            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '8px', border: '1px solid #2a2a35' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", monospace', fontSize: '14px', color: '#e5e7eb' }}>
                <code>{selectedSnippet.code}</code>
              </pre>
            </div>
          </div>
        )}

        {/* CREATE / EDIT MODE */}
        {(mode === 'create' || mode === 'edit') && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h1 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit Snippet' : 'Create New Snippet'}</h1>
              {mode === 'edit' && <button onClick={() => setMode('view')} style={{ padding: '8px 15px', background: 'none', color: '#9ca3af', border: '1px solid #374151', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaTimes /> Cancel</button>}
            </div>

            <form onSubmit={handleSaveSnippet} style={{ backgroundColor: '#18181c', padding: '30px', borderRadius: '12px', border: '1px solid #2a2a35' }}>
              <input 
                type="text" 
                placeholder="Snippet Title" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #374151', background: '#0e0e11', color: '#fff', fontSize: '1.1rem', boxSizing: 'border-box' }}
              />
              
              <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#0e0e11', marginBottom: '20px', overflow: 'hidden' }}>
                <Editor
                  value={code}
                  onValueChange={setCode}
                  highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
                  padding={15}
                  style={{ fontFamily: '"Fira Code", monospace', fontSize: 14, minHeight: '300px' }}
                />
              </div>

              {mode === 'create' && (
                <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#1e1e24', borderRadius: '6px', border: '1px dashed #374151' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '0.9rem' }}>Attach Architecture Diagram (AWS S3):</label>
                  <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ color: '#fff' }} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button type="submit" disabled={isSaving} style={{ padding: '12px 25px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaSave /> {isSaving ? 'Processing...' : (mode === 'edit' ? 'Save Changes' : 'Save to Vault')}
                </button>
                {statusMessage && <span style={{ color: '#60a5fa', fontSize: '0.9rem' }}>{statusMessage}</span>}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;