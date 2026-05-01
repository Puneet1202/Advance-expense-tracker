import { useState, useEffect } from 'react';
import api from './api/axios';
import AuthForm from './components/auth/AuthForm';
import Header from './components/dashboard/Header';
import Sidebar from './components/dashboard/Sidebar';
import TransactionArea from './components/dashboard/TransactionArea';

export default function App() {
  const [isLoading, setIsLoading]   = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [trackerData, setTrackerData] = useState({ transactions: [], accounts: [] });
  // const [darkMode, setDarkMode]     = useState(()=>{
  //   return localStorage.getItem('theme') === 'dark';
  // });


   // Shuru mein 'theme_guest' check karega, baad mein user load hone par badal jayega
    const [darkMode, setDarkMode] = useState(() => {
  const savedTheme = localStorage.getItem('theme_guest'); 
  return savedTheme === 'dark';
});


  const dateObj = new Date();
  const defaultMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;
  const [currentMonth, setCurrentMonth]   = useState(defaultMonth);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const getThemeKey = () => {
  return user ? `theme_${user.id}` : 'theme_guest';
};



 
// User load hone par uska purana preference fetch karne ke liye
useEffect(() => {
  if (user) {
    const userTheme = localStorage.getItem(`theme_${user.id}`);
    if (userTheme !== null) {
      setDarkMode(userTheme === 'dark');
    }
  }
}, [user]); // Jab bhi user login/change ho, uska theme load ho jaye

  // Apply dark mode to document
useEffect(() => {
  const themeKey = getThemeKey();
  if (darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(themeKey, 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem(themeKey, 'light');
  }
}, [darkMode, user]);

  const fetchTrackerData = async () => {
    try {
      const res = await api.get(`/tracker?month=${currentMonth}`);
      setTrackerData(res.data);
      console.log("BACKEND DATA:", res.data.user)
      if (res.data.user) setUser(res.data.user);
      setIsLoggedIn(true);
    } catch (err) {
      if (err.response?.status === 401) setIsLoggedIn(false);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchTrackerData(); }, [currentMonth]);

  /* ── Loading screen ── */
  if (isLoading) return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:'1.25rem',
      background:'var(--bg)'
    }}>
      <div style={{
        width:'52px', height:'52px', borderRadius:'16px',
        background:'var(--accent)', display:'flex', alignItems:'center',
        justifyContent:'center', fontSize:'1.3rem',
        boxShadow:'0 8px 28px var(--accent-glow)',
        animation:'fadeUp 0.5s ease both'
      }}>💳</div>
      <div style={{ display:'flex', gap:'5px' }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:'7px', height:'7px', borderRadius:'50%', background:'var(--accent)',
            animation:`pulse 1.2s ease-in-out ${i*0.18}s infinite`
          }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return <AuthForm setIsLoggedIn={setIsLoggedIn} setUser={setUser}  onLoginSuccess={fetchTrackerData}/>;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', transition:'background 0.3s' }}>
      <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'1.25rem 1.25rem 3rem' }}>

        {/* Header */}
        <div style={{ marginBottom:'1rem' }}>
          <Header
            user={user} trackerData={trackerData}
            selectedAccountId={selectedAccountId} setIsLoggedIn={setIsLoggedIn}
            currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
            availableMonths={trackerData.available_months||[]}
            darkMode={darkMode} setDarkMode={setDarkMode}
            fetchTrackerData={fetchTrackerData}
          />
        </div>

        {/* Dashboard grid — responsive via CSS class */}
        <div className="dashboard-grid">
          <Sidebar
            trackerData={trackerData} fetchTrackerData={fetchTrackerData}
            selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
          />
          <TransactionArea
            trackerData={trackerData} fetchTrackerData={fetchTrackerData}
            selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
            currentMonth={currentMonth}
          />
        </div>

        {/* Footer */}
        <p style={{ textAlign:'center', color:'var(--text-4)', fontSize:'0.72rem',
          marginTop:'2.5rem', letterSpacing:'-0.01em' }}>
          ExpenseTracker · Built with care
        </p>
      </div>
    </div>
  );
}
