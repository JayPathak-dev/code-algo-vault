import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export default function CodeEditor() {
    // Clerk authentication to securely talk to your backend
    const { getToken } = useAuth();

    // Editor State
    const [code, setCode] = useState('print("hello world")');
    const [output, setOutput] = useState('');
    const [language, setLanguage] = useState('python');
    const [isRunning, setIsRunning] = useState(false);

    // 1. The Execution Function
    const runCode = async (sourceCode) => {
        setIsRunning(true);
        setOutput('Executing...');
        
        try {
            // Grab the secure token from Clerk
            const token = await getToken();
            
            // Make the secure call to your Node.js backend
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Crucial for backend access
                },
                body: JSON.stringify({ source_code: sourceCode, language: language })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            
            // Display either the successful output or the compilation error
            setOutput(data.output || data.error || 'No output returned.');
        } catch (error) {
            console.error("Execution Error:", error);
            setOutput("Failed to reach execution server. Check connection.");
        } finally {
            setIsRunning(false);
        }
    };

    // 2. The Auto-Run Debounce Magic
    useEffect(() => {
        // Wait 1.5 seconds after the user completely stops typing
        const delayExecution = setTimeout(() => {
            if (code.trim() !== "") {
                runCode(code);
            }
        }, 1500); 

        // If they type again before 1.5 seconds, destroy the timer and start over
        return () => clearTimeout(delayExecution);
    }, [code, language]); // Re-runs anytime the code or language dropdown changes


    // 3. The UI
    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white rounded-lg overflow-hidden border border-gray-700">
            
            {/* --- TOP BAR: Title & Language Selector --- */}
            <div className="flex justify-between items-center bg-[#252526] p-3 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">{"</>"}</span>
                    <h2 className="text-lg font-semibold">Interactive Editor</h2>
                </div>
                
                <div className="flex gap-3 items-center">
                    {isRunning && <span className="text-sm text-yellow-400 animate-pulse">Running...</span>}
                    <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-[#3c3c3c] text-white text-sm rounded px-3 py-1 outline-none border border-gray-600 focus:border-blue-500"
                    >
                        <option value="python">Python 3</option>
                        <option value="javascript">JavaScript</option>
                        <option value="cpp">C++</option>
                    </select>
                </div>
            </div>

            {/* --- MIDDLE: Code Input Area --- */}
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck="false"
                className="w-full h-64 p-4 bg-[#1e1e1e] text-gray-300 font-mono text-sm resize-none outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="Write your algorithm here..."
            />

            {/* --- BOTTOM: Terminal Output --- */}
            <div className="flex-1 min-h-[150px] bg-[#000000] p-4 border-t border-gray-700 font-mono text-sm overflow-y-auto">
                <div className="text-gray-500 mb-2">{">_ Terminal Output"}</div>
                <pre className={`whitespace-pre-wrap ${output.includes('Failed') || output.includes('Error') || output.includes('Traceback') ? 'text-red-400' : 'text-green-400'}`}>
                    {output || "Awaiting execution..."}
                </pre>
            </div>

        </div>
    );
}