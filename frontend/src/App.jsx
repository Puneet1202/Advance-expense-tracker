import { useState, useEffect } from 'react';
import api from './api/axios';
import AuthForm from './components/auth/AuthForm';
import Header from './components/dashboard/Header';
import Sidebar from './components/dashboard/Sidebar';
import TransactionArea from './components/dashboard/TransactionArea';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  
  const dateObj = new Date();
  const defaultMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  const [currentMonth, setCurrentMonth] = useState(defaultMonth);

  const [trackerData, setTrackerData] = useState({ 
    total_income: 0, 
    total_expenses: 0, 
    expense_limit: 0, 
    is_saving_mode: false,
    transactions: [],
    accounts: [],
    available_months: []
  });

  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const fetchTrackerData = async () => {
    try {
      const res = await api.get(`/tracker?month=${currentMonth}`);
      setTrackerData(res.data);
      if (res.data.user) setUser(res.data.user);
      setIsLoggedIn(true);
    } catch (err) {
      if (err.response?.status === 401) setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, [currentMonth]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100"><p className="text-gray-500 font-semibold">Loading App...</p></div>;
  }

  if (!isLoggedIn) {
    return <AuthForm setIsLoggedIn={setIsLoggedIn} setUser={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Header 
          user={user} 
          trackerData={trackerData} 
          selectedAccountId={selectedAccountId} 
          setIsLoggedIn={setIsLoggedIn} 
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          availableMonths={trackerData.available_months || []}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Sidebar 
              trackerData={trackerData} 
              fetchTrackerData={fetchTrackerData} 
              selectedAccountId={selectedAccountId}
              setSelectedAccountId={setSelectedAccountId}
            />
          </div>
          
          <TransactionArea 
            trackerData={trackerData} 
            fetchTrackerData={fetchTrackerData} 
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            currentMonth={currentMonth}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
