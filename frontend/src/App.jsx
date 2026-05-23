import { useState, useEffect } from 'react';
import axios from 'axios';
import EditorPkg from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/themes/prism-tomorrow.css';

// Vite Interop Fix
const Editor = EditorPkg.default || EditorPkg;

function App() {
  const [snippets, setSnippets] = useState([]);
  
  // Unified Form State
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

  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Unified Submission Logic
  const handleSaveSnippet = async (e) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return alert("Title and Code are required!");
    
    setIsSaving(true);
    let finalImageUrl = null;

    try {
      // Step A: If there is an image, upload to AWS S3 first
      if (file) {
        setStatusMessage('Uploading image to AWS S3...');
        const urlRes = await axios.post('/api/upload-url', { fileName: file.name, fileType: file.type });
        const { uploadUrl, publicUrl } = urlRes.data;
        
        await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type } });
        finalImageUrl = publicUrl; // Save the S3 link
      }

      // Step B: Save everything to PostgreSQL
      setStatusMessage('Saving to PostgreSQL Database...');
      await axios.post('/api/snippets', { 
        title, 
        code, 
        imageUrl: finalImageUrl 
      });
      
      // Step C: Cleanup and Refresh
      setTitle('');
      setCode('// Paste your algorithm here...\n');
      setFile(null);
      setStatusMessage('Snippet saved successfully!');
      fetchSnippets();
      
      // Clear success message after 3 seconds
      setTimeout(() => setStatusMessage(''), 3000);
      
    } catch (error) {
      console.error(error);
      setStatusMessage('Error saving snippet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Code & Algo Vault</h1>
      
      {/* UNIFIED CREATION FORM */}
      <div style={{ background: '#1e1e1e', padding: '25px', borderRadius: '10px', marginBottom: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <h2>Add New Snippet</h2>
        <form onSubmit={handleSaveSnippet}>
          <input 
            type="text" 
            placeholder="Snippet Title" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #333', background: '#2d2d2d', color: '#fff', boxSizing: 'border-box' }}
          />
          
          <div style={{ border: '1px solid #333', borderRadius: '5px', background: '#2d2d2d', marginBottom: '15px', overflow: 'hidden' }}>
            <Editor
              value={code}
              onValueChange={code => setCode(code)}
              highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
              padding={15}
              style={{ fontFamily: '"Fira Code", monospace', fontSize: 14, minHeight: '150px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Attach Architecture Diagram (Optional):</label>
            <input type="file" onChange={handleFileChange} style={{ color: '#fff' }} />
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {isSaving ? 'Processing...' : 'Save to Vault'}
          </button>
          
          {statusMessage && (
            <p style={{ marginTop: '15px', textAlign: 'center', color: '#4da6ff', fontWeight: 'bold' }}>{statusMessage}</p>
          )}
        </form>
      </div>

      {/* SNIPPETS DISPLAY */}
      <h2>Your Vault</h2>
      {snippets.length === 0 ? <p style={{color: '#888'}}>No snippets saved yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {snippets.map(snippet => (
            <div key={snippet.id} style={{ border: '1px solid #333', borderRadius: '10px', background: '#1e1e1e', overflow: 'hidden' }}>
              
              <div style={{ padding: '15px 20px', background: '#252525', borderBottom: '1px solid #333' }}>
                <h3 style={{ margin: 0 }}>{snippet.title}</h3>
              </div>

              {/* RENDER THE S3 IMAGE IF IT EXISTS */}
              {snippet.image_url && (
                <div style={{ padding: '20px', borderBottom: '1px solid #333', textAlign: 'center', background: '#111' }}>
                  <img src={snippet.image_url} alt="Architecture Diagram" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '5px' }} />
                </div>
              )}

              <div style={{ padding: '20px' }}>
                 <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", monospace', fontSize: '14px', color: '#e06c75' }}>
                  <code>{snippet.code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;