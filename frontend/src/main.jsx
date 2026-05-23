import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      
      {/* If the user is logged out, show the beautiful Clerk login screen */}
      <SignedOut>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0e0e11' }}>
          <SignIn routing="hash" />
        </div>
      </SignedOut>

      {/* If the user is logged in, show the Vault! */}
      <SignedIn>
        <App />
      </SignedIn>

    </ClerkProvider>
  </React.StrictMode>,
)