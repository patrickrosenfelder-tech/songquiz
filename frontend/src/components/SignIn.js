import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import './Auth.css';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error("Couldn't load Google sign-in.")));
  });
}

function SignIn({ config, onSignedIn }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [devName, setDevName] = useState('');
  const googleClientId = config?.googleClientId;

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            try {
              setError(null);
              const { user } = await api('/auth/google', { method: 'POST', body: { credential } });
              onSignedIn(user);
            } catch (err) {
              setError(err.message);
            }
          }
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 280
        });
      })
      .catch((err) => setError(err.message));

    return () => { cancelled = true; };
  }, [googleClientId, onSignedIn]);

  const devSignIn = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const { user } = await api('/auth/dev', { method: 'POST', body: { name: devName } });
      onSignedIn(user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="sign-in">
      {googleClientId ? (
        <div className="google-button" ref={buttonRef} />
      ) : (
        <p className="auth-note">Google sign-in isn't set up on this server yet.</p>
      )}

      {config?.devLogin && (
        <form className="dev-login" onSubmit={devSignIn}>
          <span className="dev-login-label">Dev sign-in (local only)</span>
          <div className="dev-login-row">
            <input
              className="username-input"
              placeholder="Test account name"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
            />
            <button className="copy-button" type="submit" disabled={!devName.trim()}>Sign in</button>
          </div>
        </form>
      )}

      {error && <p className="join-error">{error}</p>}
    </div>
  );
}

export default SignIn;
