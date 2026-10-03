import React, { useState } from 'react';
import { api } from '../api';
import './Auth.css';

function DisplayNameSetup({ onSaved, onSignOut }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { user } = await api('/me/display-name', { method: 'PUT', body: { displayName: name } });
      onSaved(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lobby-container">
      <form className="card lobby-box" onSubmit={save}>
        <h2>Pick your stage name</h2>
        <p className="description">This is how you'll show up on leaderboards and to friends.</p>
        <div className="join-section">
          <input
            className="username-input"
            placeholder="DJ Patrick"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={saving || name.trim().length < 3}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
          {error && <p className="join-error">{error}</p>}
          <button className="link-button" type="button" onClick={onSignOut}>Use a different account</button>
        </div>
      </form>
    </div>
  );
}

export default DisplayNameSetup;
