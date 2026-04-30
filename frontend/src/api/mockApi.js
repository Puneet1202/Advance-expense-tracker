// Mock API - Backend ke bina design dekhne ke liye
// Ye file real API ki jagah use hoti hai jab VITE_MOCK_MODE=true ho

const mockUser = { name: 'Puneet Kumar', email: 'puneet@demo.com' };

const mockTrackerData = {
  user: mockUser,
  total_income: 85000,
  total_expenses: 42500,
  expense_limit: 50000,
  is_saving_mode: true,
  available_months: ['2026-04', '2026-03', '2026-02'],
  accounts: [
    { id: 1, name: 'HDFC Bank', balance: 28500 },
    { id: 2, name: 'Cash', balance: 8000 },
    { id: 3, name: 'UPI / GPay', balance: 6000 },
  ],
  transactions: [
    { id: 1, type: 'income', amount: 60000, description: 'Monthly Salary', account_id: 1, account_name: 'HDFC Bank', created_at: '2026-04-01T10:00:00Z' },
    { id: 2, type: 'income', amount: 25000, description: 'Freelance Project', account_id: 1, account_name: 'HDFC Bank', created_at: '2026-04-10T14:00:00Z' },
    { id: 3, type: 'expense', amount: 15000, description: 'House Rent', account_id: 2, account_name: 'Cash', created_at: '2026-04-02T09:00:00Z' },
    { id: 4, type: 'expense', amount: 4500, description: 'Groceries & Food', account_id: 3, account_name: 'UPI / GPay', created_at: '2026-04-05T18:30:00Z' },
    { id: 5, type: 'expense', amount: 1200, description: 'Netflix + Spotify', account_id: 3, account_name: 'UPI / GPay', created_at: '2026-04-06T12:00:00Z' },
    { id: 6, type: 'expense', amount: 8000, description: 'Bike EMI', account_id: 1, account_name: 'HDFC Bank', created_at: '2026-04-08T11:00:00Z' },
    { id: 7, type: 'expense', amount: 3200, description: 'Electricity Bill', account_id: 2, account_name: 'Cash', created_at: '2026-04-12T16:00:00Z' },
    { id: 8, type: 'expense', amount: 5600, description: 'Shopping - Flipkart', account_id: 1, account_name: 'HDFC Bank', created_at: '2026-04-15T20:00:00Z' },
    { id: 9, type: 'expense', amount: 3000, description: 'Petrol', account_id: 2, account_name: 'Cash', created_at: '2026-04-18T08:00:00Z' },
    { id: 10, type: 'expense', amount: 2000, description: 'Restaurant - Zomato', account_id: 3, account_name: 'UPI / GPay', created_at: '2026-04-20T21:00:00Z' },
  ]
};

let nextId = 11;
let currentData = JSON.parse(JSON.stringify(mockTrackerData));

// Simulate delay
const delay = (ms = 200) => new Promise(res => setTimeout(res, ms));

export const mockApi = {
  get: async (url) => {
    await delay();
    if (url.startsWith('/tracker')) {
      return { data: { ...currentData } };
    }
    throw { response: { status: 404 } };
  },

  post: async (url, body) => {
    await delay(300);

    if (url === '/auth/login') {
      if (body.email === 'demo@demo.com' && body.password === 'demo123') {
        return { data: { user: mockUser } };
      }
      throw { response: { data: { message: 'Invalid email or password' } } };
    }

    if (url === '/auth/register') {
      return { data: { message: 'Account created! Please login.' } };
    }

    if (url === '/tracker/transaction') {
      const acc = currentData.accounts.find(a => a.id === Number(body.account_id));
      const newTxn = {
        id: nextId++,
        type: body.type,
        amount: body.amount,
        description: body.description || 'No description',
        account_id: Number(body.account_id),
        account_name: acc?.name || 'General',
        created_at: new Date().toISOString()
      };
      currentData.transactions.unshift(newTxn);
      if (body.type === 'income') {
        currentData.total_income += body.amount;
        if (acc) acc.balance += body.amount;
      } else {
        currentData.total_expenses += body.amount;
        if (acc) acc.balance -= body.amount;
      }
      return { data: newTxn };
    }

    if (url === '/tracker/account') {
      const newAcc = { id: nextId++, name: body.name, balance: 0 };
      currentData.accounts.push(newAcc);
      return { data: newAcc };
    }

    if (url === '/tracker/settings') {
      currentData.expense_limit = body.expense_limit;
      currentData.is_saving_mode = body.is_saving_mode;
      return { data: { success: true } };
    }

    throw { response: { status: 404 } };
  },

  delete: async (url) => {
    await delay(200);

    if (url.startsWith('/tracker/transaction/')) {
      const id = Number(url.split('/').pop());
      const txn = currentData.transactions.find(t => t.id === id);
      if (txn) {
        currentData.transactions = currentData.transactions.filter(t => t.id !== id);
        const acc = currentData.accounts.find(a => a.id === txn.account_id);
        if (txn.type === 'income') {
          currentData.total_income -= txn.amount;
          if (acc) acc.balance -= txn.amount;
        } else {
          currentData.total_expenses -= txn.amount;
          if (acc) acc.balance += txn.amount;
        }
      }
      return { data: { success: true } };
    }

    if (url.startsWith('/tracker/account/')) {
      const id = Number(url.split('/').pop());
      const acc = currentData.accounts.find(a => a.id === id);
      if (acc && acc.balance !== 0) {
        throw { response: { data: { message: 'BALANCE_REMAINING', balance: acc.balance } } };
      }
      currentData.accounts = currentData.accounts.filter(a => a.id !== id);
      currentData.transactions = currentData.transactions.filter(t => t.account_id !== id);
      return { data: { success: true } };
    }

    if (url === '/tracker/reset') {
      currentData = JSON.parse(JSON.stringify(mockTrackerData));
      return { data: { success: true } };
    }

    throw { response: { status: 404 } };
  }
};
