import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Filter transactions by date range
const filterByRange = (transactions, fromDate, toDate) => {
  if (!fromDate && !toDate) return transactions;
  return transactions.filter(t => {
    const d = t.created_at.substring(0, 10); // 'YYYY-MM-DD'
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });
};

const getPeriodLabel = (rangeType, fromDate, toDate, fromMonth, toMonth) => {
  if (rangeType === 'date') return `${fromDate || '...'} to ${toDate || '...'}`;
  if (rangeType === 'month') return `${fromMonth || '...'} to ${toMonth || '...'}`;
  return 'All-Time';
};

export const downloadPDF = (user, transactions, accounts, selectedAccountId, rangeType, fromDate, toDate, fromMonth, toMonth) => {
  try {
    // Apply range filter
    let from = fromDate, to = toDate;
    if (rangeType === 'month') {
      from = fromMonth ? `${fromMonth}-01` : null;
      // last day of toMonth
      if (toMonth) {
        const [y, m] = toMonth.split('-');
        to = `${y}-${m}-${new Date(y, m, 0).getDate()}`;
      }
    }
    const txns = filterByRange(
      selectedAccountId ? transactions.filter(t => t.account_id === selectedAccountId) : transactions,
      from, to
    );

    let totalInc = 0, totalExp = 0;
    txns.forEach(t => {
      if (t.type === 'income') totalInc += t.amount;
      else totalExp += t.amount;
    });

    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text("Expense Tracker Report", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`User: ${user?.name || 'User'} (${user?.email || 'N/A'})`, 14, 34);
    doc.text(`Period: ${getPeriodLabel(rangeType, fromDate, toDate, fromMonth, toMonth)}`, 14, 40);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 46);

    doc.setFontSize(11);
    doc.text(`Total Income: Rs. ${totalInc}`, 14, 58);
    doc.text(`Total Expenses: Rs. ${totalExp}`, 14, 64);
    doc.text(`Remaining: Rs. ${totalInc - totalExp}`, 14, 70);

    let startY = 78;
    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc) { doc.text(`Account: ${acc.name} (Balance: Rs. ${acc.balance})`, 14, 78); startY = 86; }
    }

    autoTable(doc, {
      startY,
      head: [["Date", "Type", "Account", "Description", "Amount"]],
      body: txns.map(t => [
        new Date(t.created_at).toLocaleDateString(),
        t.type.toUpperCase(),
        t.account_name || 'General',
        t.description,
        `Rs. ${t.amount}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`Expense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("PDF Error:", error);
    alert("Error generating PDF.");
  }
};

export const downloadExcel = (user, transactions, accounts, selectedAccountId, rangeType, fromDate, toDate, fromMonth, toMonth) => {
  try {
    let from = fromDate, to = toDate;
    if (rangeType === 'month') {
      from = fromMonth ? `${fromMonth}-01` : null;
      if (toMonth) {
        const [y, m] = toMonth.split('-');
        to = `${y}-${m}-${new Date(y, m, 0).getDate()}`;
      }
    }
    const txns = filterByRange(
      selectedAccountId ? transactions.filter(t => t.account_id === selectedAccountId) : transactions,
      from, to
    );

    let totalInc = 0, totalExp = 0;
    txns.forEach(t => {
      if (t.type === 'income') totalInc += t.amount;
      else totalExp += t.amount;
    });

    const wb = XLSX.utils.book_new();
    const period = getPeriodLabel(rangeType, fromDate, toDate, fromMonth, toMonth);

    const data = [
      ["EXPENSE TRACKER REPORT"],
      [],
      ["User", `${user?.name || 'User'} (${user?.email || 'N/A'})`],
      ["Period", period],
      ["Generated", new Date().toLocaleDateString()],
      [],
      ["Total Income", `Rs. ${totalInc}`],
      ["Total Expenses", `Rs. ${totalExp}`],
      ["Remaining", `Rs. ${totalInc - totalExp}`],
    ];

    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc) data.push(["Account", `${acc.name} (Balance: Rs. ${acc.balance})`]);
    }

    data.push([]);
    data.push(["Date", "Type", "Account", "Description", "Amount (Rs.)"]);
    txns.forEach(t => data.push([
      new Date(t.created_at).toLocaleDateString(),
      t.type.toUpperCase(),
      t.account_name || 'General',
      t.description,
      t.amount
    ]));

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:10},{wch:15},{wch:30},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Expense_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Excel Error:", error);
    alert("Error generating Excel.");
  }
};
