import { useState } from 'react';
import api from '../../api/axios';

const AuthForm = ({ setIsLoggedIn, setUser }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authMsg, setAuthMsg] = useState('');
  const [authErr, setAuthErr] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMsg(''); setAuthErr('');
    try {
      if (isLoginView) {
        const res = await api.post('/auth/login', { email: authForm.email, password: authForm.password });
        setUser(res.data.user);
        setIsLoggedIn(true);
      } else {
        const res = await api.post('/auth/register', authForm);
        setAuthMsg(res.data.message);
        setTimeout(() => setIsLoginView(true), 2000);
      }
    } catch (err) {
      console.error(err);
      setAuthErr(err.response?.data?.message || err.message || 'Network Error or Server Down');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          {isLoginView ? 'Login to Expense Tracker' : 'Create an Account'}
        </h2>
        {authMsg && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">{authMsg}</div>}
        {authErr && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{authErr}</div>}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {!isLoginView && (
            <input type="text" placeholder="Name" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} required className="w-full px-3 py-2 border rounded-md" />
          )}
          <input type="email" placeholder="Email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required className="w-full px-3 py-2 border rounded-md" />
          <input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required className="w-full px-3 py-2 border rounded-md" />
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isLoginView ? 'Login' : 'Register'}</button>
        </form>
        <button onClick={() => { setIsLoginView(!isLoginView); setAuthMsg(''); setAuthErr(''); }} className="mt-4 w-full text-sm text-blue-600">
          {isLoginView ? "Don't have an account? Register" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

export default AuthForm;
