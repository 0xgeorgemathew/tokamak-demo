// lib/api/1inch.ts
import { Config } from '../config';
import { Logger } from "../constants";
import axios from 'axios';
/**
 * @file This file centralizes all interactions with the 1inch APIs.
 * By creating dedicated functions for each data type we need, we keep our
 * main application logic clean and focused on using the data, not fetching it.
 * This also makes it easier to handle API keys, error formats, and caching in one place.
 */

const API_BASE_URL = 'https://1inch-vercel-proxy-psi.vercel.app';
/**
 * Fetches the complete swap history for a given wallet address.
 * @param {string} address - The wallet address to analyze.
 * @param {number} chainId - The chain ID (e.g., 1 for Ethereum).
 * @returns {Promise<any[]>} A promise that resolves to an array of swap events.
 */
export const getSwapHistory = async (address: string, chainId: number) => {
    // LOGIC TO BE IMPLEMENTED:
    // 1. Construct the URL for the 1inch History API endpoint.
    //    - Endpoint: /v2.0/{chainId}/history/events-by-address
    // 2. Use the 'fetch' API to make a POST request.
    //    - The body should contain the wallet address and specify we only want "swap" events.
    // 3. Handle potential errors (e.g., network issues, 404 Not Found).
    // 4. If the request is successful, parse the JSON response.
    // 5. Return the array of swap events.
    console.log(`Fetching swap history for ${address} on chain ${chainId}...`);
    // return fetch(...);
    return []; // Placeholder
};

/**
 * Fetches the historical portfolio value for a given wallet address.
 * @param {string} address - The wallet address to analyze.
 * @param {number} chainId - The chain ID.
 * @returns {Promise<[number, number][]>} A promise that resolves to an array of [timestamp, value] tuples.
 */
/**
 * Fetches the historical portfolio value for a given wallet address.
 * @param {string} address - The wallet address to analyze.
 * @param {number} chainId - The chain ID.
 * @returns {Promise<[number, number][]>} A promise that resolves to an array of [timestamp, value] tuples.
 */
/**
 * Fetches the historical portfolio value for a given wallet address.
 * THIS IS THE CORRECTED VERSION.
 * @param {string} address - The wallet address to analyze.
 * @param {number} chainId - The chain ID.
 * @returns {Promise<any>} A promise that resolves to the API response data.
 *                         Note: We'll refine the return type after inspecting the real data.
 */
export const getHistoricalPortfolioValue = async (address: string, chainId: number) => {
    // 1. Define the correct endpoint path.
    const endpointPath = '/portfolio/v5.0/general/chart';

    // 2. Use URLSearchParams to build the query string correctly.
    const params = new URLSearchParams({
        chain_id: chainId.toString(),
        addresses: address, // The API accepts one or more comma-separated addresses.
        timerange: '3years', // Fetch the maximum possible range to get all data.
        use_cache: 'true',
    });

    // 3. Construct the full URL.
    const url = `${API_BASE_URL}${endpointPath}?${params.toString()}`;

    console.log(`Fetching from (Corrected): ${url}`); // For debugging

    // 4. Make the GET request using 'fetch'.
    const response = await fetch(url);

    // 5. Handle errors.
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.description || `API Error: ${response.statusText} (${response.status})`);
    }

    // 6. Parse the JSON response.
    const data = await response.json();

    // 7. Return the 'result' property which contains the chart data.
    // Based on the docs, the data we want is inside the 'result' key.
    return data.result;
};

/**
 * Fetches the historical price data for a single token against USD.
 * @param {string} tokenAddress - The address of the token (e.g., WETH).
 * @param {number} chainId - The chain ID.
 * @returns {Promise<any[]>} A promise that resolves to an array of historical price points.
 */
export const getHistoricalTokenPrice = async (tokenAddress: string, chainId: number) => {
    // LOGIC TO BE IMPLEMENTED:
    // 1. Define a stablecoin address to price against (e.g., USDC on the given chain).
    // 2. Construct the URL for the 1inch Charts API.
    //    - Endpoint: /{chainId}/chart/v1/historical/{tokenAddress}/{stablecoinAddress}
    // 3. Make a GET request.
    // 4. Handle errors.
    // 5. Parse and return the price data.
    console.log(`Fetching historical price for ${tokenAddress} on chain ${chainId}...`);
    // return fetch(...);
    return []; // Placeholder
};

export async function callRpc(chainId: number, method: string, params: any[]): Promise<any> {
    const url = `${Config.API_BASE_URL}/web3/${chainId}`;
    const body = { jsonrpc: '2.0', id: 1, method, params };
    Logger.debug(`Calling RPC: ${method} on chain ${chainId}`, { params });

    try {
        const response = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
        if ((response.data as any).error) throw new Error(`RPC Error: ${(response.data as any).error.message}`);
        return (response.data as any).result;
    } catch (error: any) {
        if (error.response) {
            Logger.error(`Axios Error calling RPC: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

// IMPROVED: Now accepts blockNumber directly to avoid a redundant RPC call.
export async function getTransactionTrace(chainId: number, txHash: string, blockNumber: number): Promise<any> {
    Logger.info(`Fetching detailed trace for ${txHash} in block ${blockNumber}...`);
    const traceUrl = `${Config.API_BASE_URL}/traces/v1.0/chain/${chainId}/block-trace/${blockNumber}/tx-hash/${txHash}`;
    const response = await axios.get(traceUrl);
    return response.data;
}
export async function getSpotPrices(chainId: number, addresses: string[]): Promise<any> {
    Logger.info(`Fetching 1inch spot prices for ${addresses.length} addresses on chain ${chainId}`);

    const addressString = addresses.join(',');
    const url = `${Config.API_BASE_URL}/${chainId}/${addressString}?currency=USD`;

    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error: any) {
        if (error.response) {
            Logger.error(`Axios Error calling 1inch Spot Price API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}
