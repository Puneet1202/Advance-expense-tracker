// Centralized Prompt Registry using pure static ESM imports
// 100% Cloudflare Workers Compatible (No fs, path, url, or __dirname)

// System Prompts
import { corePrompt } from './system/core.js';
import { sqlPrompt } from './system/sql.js';
import { vectorPrompt } from './system/vector.js';
import { hybridPrompt } from './system/hybrid.js';
import { securityPrompt } from './system/security.js';

// Intent Prompts
import { expenseAddPrompt } from './intents/expense-add.js';
import { expenseDeletePrompt } from './intents/expense-delete.js';
import { balanceCheckPrompt } from './intents/balance-check.js';
import { spendingAnalysisPrompt } from './intents/spending-analysis.js';
import { savingsAdvicePrompt } from './intents/savings-advice.js';

// Validation Prompts
import { missingFieldsPrompt } from './validation/missing-fields.js';
import { confirmationPrompt } from './validation/confirmation.js';
import { antiHallucinationPrompt } from './validation/anti-hallucination.js';

// Response Prompts
import { casualChatPrompt } from './responses/casual-chat.js';
import { hinglishStylePrompt } from './responses/hinglish-style.js';
import { fallbackPrompt } from './responses/fallback.js';

// 1. Centralized Prompt Registry
export const SYSTEM_PROMPTS = {
    core: corePrompt,
    sql: sqlPrompt,
    vector: vectorPrompt,
    hybrid: hybridPrompt,
    security: securityPrompt,
};

export const INTENT_PROMPTS = {
    expenseAdd: expenseAddPrompt,
    expenseDelete: expenseDeletePrompt,
    balanceCheck: balanceCheckPrompt,
    spendingAnalysis: spendingAnalysisPrompt,
    savingsAdvice: savingsAdvicePrompt,
};

export const VALIDATION_PROMPTS = {
    missingFields: missingFieldsPrompt,
    confirmation: confirmationPrompt,
    antiHallucination: antiHallucinationPrompt,
};

export const RESPONSE_PROMPTS = {
    casualChat: casualChatPrompt,
    hinglishStyle: hinglishStylePrompt,
    fallback: fallbackPrompt,
};

// 2. Dynamic Prompt Composer & Intent-Based Layering
export function composeDynamicPrompt(intent = 'DEFAULT', customRules = '') {
    const layers = [SYSTEM_PROMPTS.core];

    // Layer System/Intent architecture based on classification
    switch (intent.toUpperCase()) {
        case 'SQL':
            layers.push('=== SQL EXACT TRUTH LAYER ===');
            layers.push(SYSTEM_PROMPTS.sql);
            layers.push(INTENT_PROMPTS.balanceCheck); 
            layers.push(INTENT_PROMPTS.spendingAnalysis);  //  add this line 
            break;
        case 'VECTOR':
            layers.push('=== VECTOR SEMANTIC RETRIEVAL LAYER ===');
            layers.push(SYSTEM_PROMPTS.vector);
            layers.push(INTENT_PROMPTS.spendingAnalysis);
            layers.push(INTENT_PROMPTS.savingsAdvice);
            break;
        case 'HYBRID':
            layers.push('=== HYBRID ORCHESTRATION LAYER ===');
            layers.push(SYSTEM_PROMPTS.hybrid);
            layers.push(SYSTEM_PROMPTS.sql);
            layers.push(SYSTEM_PROMPTS.vector);
            break;
        case 'EXPENSE_ADD':
            layers.push('=== EXPENSE CREATION LAYER ===');
            layers.push(SYSTEM_PROMPTS.sql);
            layers.push(INTENT_PROMPTS.expenseAdd);
            break;
        case 'EXPENSE_DELETE':
            layers.push('=== DESTRUCTIVE ACTION LAYER ===');
            layers.push(SYSTEM_PROMPTS.sql);
            layers.push(INTENT_PROMPTS.expenseDelete);
            layers.push(VALIDATION_PROMPTS.confirmation);
            break;
        case 'CASUAL':
        default:
            layers.push('=== CONVERSATIONAL LAYER ===');
            layers.push(RESPONSE_PROMPTS.casualChat);
            break;
    }

    // Always attach mandatory anti-hallucination, missing fields, and security validation layers
    layers.push('=== FINTECH SAFETY & VALIDATION LAYER ===');
    layers.push(SYSTEM_PROMPTS.security);
    layers.push(VALIDATION_PROMPTS.antiHallucination);
    layers.push(VALIDATION_PROMPTS.missingFields);

    if (customRules) {
        layers.push('=== USER CUSTOM RULES ===');
        layers.push(customRules);
    }

    // Add native multi-lingual support layer
    layers.push('=== COMMUNICATION LAYER ===');
    layers.push(RESPONSE_PROMPTS.hinglishStyle);

    return layers.join('\n\n');
}

// Default monolithic ready string export for generic workflows
export const COMPOSED_EXPENSE_TRACKER_PROMPT = composeDynamicPrompt('SQL');
