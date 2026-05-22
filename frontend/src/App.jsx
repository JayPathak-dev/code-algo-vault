import { useState, useEffect } from 'react';

function App() {
  const [snippets, setSnippets] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');

  // 1. Fetch Snippets (Existing Logic)
  useEffect(() => {
    fetch('/api/snippets')
      .then(response => response.json())
      .then(data => setSnippets(data))
      .catch(error => console.error("Error fetching snippets:", error));
  }, []);

  // 2. Handle File Selection
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // 3. Handle the Upload Process
  const handleUpload = async () => {
    if (!file) return alert('Please select a file first.');
    setUploadStatus('Requesting secure URL...');

    try {
      // Step A: Get the Presigned URL from our Node backend
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });
      
      const { uploadUrl, publicUrl } = await response.json();

      setUploadStatus('Uploading directly to AWS S3...');

      // Step B: Use the URL to upload directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (uploadResponse.ok) {
        setUploadStatus('Upload successful!');
        setUploadedUrl(publicUrl);
        setFile(null); // Clear the input
      } else {
        setUploadStatus('Failed to upload to S3.');
      }
    } catch (error) {
      console.error(error);
      setUploadStatus('Error during upload process.');
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto', color: '#fff', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1>Code & Algo Vault 2.0!</h1>
      
      {/* S3 UPLOAD SECTION */}
      <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2>Upload Architecture Diagram</h2>
        <input type="file" onChange={handleFileChange} style={{ marginBottom: '10px', display: 'block' }} />
        <button 
          onClick={handleUpload} 
          style={{ padding: '10px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          Upload to Vault
        </button>
        <p style={{ marginTop: '10px', fontStyle: 'italic' }}>{uploadStatus}</p>
        
        {uploadedUrl && (
          <div style={{ marginTop: '15px' }}>
            <p>File uploaded successfully! View it here:</p>
            <a href={uploadedUrl} target="_blank" rel="noreferrer" style={{ color: '#4da6ff' }}>{uploadedUrl}</a>
          </div>
        )}
      </div>

      {/* SNIPPETS SECTION */}
      <h2>Saved Snippets</h2>
      {snippets.length === 0 ? <p>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {snippets.map(snippet => (
            <div key={snippet.id} style={{ border: '1px solid #444', padding: '15px', borderRadius: '8px', background: '#252525' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>{snippet.title}</h3>
              <pre style={{ background: '#1e1e1e', color: '#abb2bf', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
                <code>{snippet.code}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;