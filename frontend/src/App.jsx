import { useState, useEffect } from 'react';

function App() {
  const [snippets, setSnippets] = useState([]);

  useEffect(() => {
    // This calls the backend API we just built
    fetch('/api/snippets')
      .then(response => response.json())
      .then(data => setSnippets(data))
      .catch(error => console.error("Error fetching from backend:", error));
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}>
      <h1>Code & Algo Vault</h1>
      <p>Data fetched directly from the Node.js backend API:</p>
      
      {snippets.length === 0 ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {snippets.map(snippet => (
            <div key={snippet.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>{snippet.title}</h3>
              <pre style={{ background: '#282c34', color: '#abb2bf', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
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