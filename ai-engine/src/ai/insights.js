// FILE: ai-engine/src/ai/insights.js
// KAAM: Smart Financial Insight Engine layer executed before LLM orchestration
// RETURNS: Processed structured JSON representing deep financial indicators and smart coaching heuristics

export function generateFinancialInsights(transactions = []) {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let monthly_income = 0;
    let monthly_expenses = 0;
    const categoryMap = {};
    const descriptionCounts = {};
    const recurring_expenses = [];

    transactions.forEach(t => {
        // Exclude account initial/closing balance entries from actual behavioral trends
        if (t.description?.includes('(Account Closing)')) return;

        const amt = Number(t.amount) || 0;
        const isCurrentMonth = t.created_at?.startsWith(currentMonthPrefix) || false;

        if (t.type === 'income') {
            if (isCurrentMonth) monthly_income += amt;
        } else if (t.type === 'expense') {
            if (isCurrentMonth) monthly_expenses += amt;

            // Aggregate Category Dominance
            const cat = t.category || 'Other';
            categoryMap[cat] = (categoryMap[cat] || 0) + amt;

            // Track recurring candidates
            const descLower = (t.description || '').toLowerCase().trim();
            if (descLower) {
                descriptionCounts[descLower] = (descriptionCounts[descLower] || 0) + 1;
                if (/netflix|spotify|prime|hotstar|rent|gym|subscription|broadband|wifi|bill/i.test(descLower) || descriptionCounts[descLower] > 1) {
                    if (!recurring_expenses.includes(t.description)) {
                        recurring_expenses.push(t.description);
                    }
                }
            }
        }
    });

    // Ratios
    const net = monthly_income - monthly_expenses;
    let savings_rate_val = monthly_income > 0 ? ((net / monthly_income) * 100) : 0;
    if (savings_rate_val < 0) savings_rate_val = 0;
    const savings_rate = `${Math.round(savings_rate_val)}%`;

    let expense_ratio_val = monthly_income > 0 ? ((monthly_expenses / monthly_income) * 100) : (monthly_expenses > 0 ? 100 : 0);
    const expense_ratio = `${Math.round(expense_ratio_val)}%`;

    // Dominant Category
    let top_spending_category = 'None';
    let maxCatAmt = 0;
    Object.entries(categoryMap).forEach(([cat, amt]) => {
        if (amt > maxCatAmt) {
            maxCatAmt = amt;
            top_spending_category = cat;
        }
    });

    // Financial Health Assessment
    let financial_health = "Good";
    if (monthly_income === 0 && monthly_expenses > 0) {
        financial_health = "Critical (No documented monthly income)";
    } else if (expense_ratio_val > 90) {
        financial_health = "Critical Overspending";
    } else if (expense_ratio_val > 75) {
        financial_health = "Needs Attention";
    } else if (savings_rate_val >= 30) {
        financial_health = "Excellent";
    }

    // Contextual Actionable Recommendations
    const budget_recommendations = [];
    if (financial_health.includes("Critical") || financial_health.includes("Attention")) {
        budget_recommendations.push("Implement the 50/30/20 budgeting rule immediately to control baseline operational burn.");
    }
    if (top_spending_category === 'Food' && maxCatAmt > (monthly_expenses * 0.25)) {
        budget_recommendations.push("Food/Dining accounts for over 25% of monthly spend. Prioritizing home meals can unlock immediate extra savings.");
    }
    if (top_spending_category === 'Shopping' && maxCatAmt > (monthly_expenses * 0.25)) {
        budget_recommendations.push("Impulse shopping dominance detected. Apply the '48-hour pause rule' before checking out non-essential carts.");
    }
    if (recurring_expenses.length > 0) {
        budget_recommendations.push(`Audit recurring charges (${recurring_expenses.slice(0, 3).join(', ')}) to eliminate phantom digital drag.`);
    }
    if (savings_rate_val > 25) {
        budget_recommendations.push("High cash surplus available. Consider setting up automated weekly/monthly SIP transfers to index assets.");
    }

    // Default universal recommendation if array remains empty
    if (budget_recommendations.length === 0) {
        budget_recommendations.push("Maintain current financial monitoring habits to sustain long-term compound wealth preservation.");
    }

    return {
        monthly_income: Math.round(monthly_income),
        monthly_expenses: Math.round(monthly_expenses),
        savings_rate,
        expense_ratio,
        top_spending_category,
        financial_health,
        recurring_expenses_detected: recurring_expenses.length,
        budget_recommendations
    };
}
