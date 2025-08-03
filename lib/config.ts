// lib/analysis/config.ts

import OpenAI from 'openai';

// Note: In Next.js, .env.local variables are automatically loaded.
// No need for dotenv.config() in Next.js environment.

export const Config = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LLM_MODEL: 'gpt-4.1',
    API_BASE_URL: 'https://1inch-vercel-proxy-psi.vercel.app',
};

// Lazy initialization of OpenAI client to avoid client-side errors
let _openai: OpenAI | null = null;

export const getOpenAI = (): OpenAI => {
    if (!_openai) {
        if (!Config.OPENAI_API_KEY) {
            console.error('OpenAI API key must be set in a .env file.');
            throw new Error('Server configuration error: Missing OpenAI API key.');
        }
        _openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
    }
    return _openai;
};

// Backwards compatibility export - but this should only be used on server-side
export const openai = getOpenAI;