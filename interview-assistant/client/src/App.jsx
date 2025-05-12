import React, { useState } from 'react';
import LogIn from './components/auth/Login';
import SignUp from './components/auth/Signup';
import Interview from './components/Interview';
import { AuthProvider } from './context/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';

const App = () => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        {!user ? (
          <div className="auth-container">
            <div className="auth-toggle">
              <button 
                onClick={() => setShowLogin(true)} 
                className={showLogin ? 'active' : ''}
              >
                Login
              </button>
              <button 
                onClick={() => setShowLogin(false)}
                className={!showLogin ? 'active' : ''}
              >
                Sign Up
              </button>
            </div>
            {showLogin ? <LogIn /> : <SignUp />}
          </div>
        ) : (
          <Interview />
        )}
      </div>
    </AuthProvider>
  );
};

export default App;