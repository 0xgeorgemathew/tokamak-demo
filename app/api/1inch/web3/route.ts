import { NextRequest, NextResponse } from "next/server";

const INCH_API_KEY = process.env.INCH_API_KEY;
const INCH_BASE_URL = "https://api.1inch.dev";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, nodeType, jsonrpc, method, params, id } = body;

    if (!chainId) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    if (!INCH_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    let apiUrl = `${INCH_BASE_URL}/web3/${chainId}`;
    if (nodeType) {
      apiUrl += `/${nodeType}`;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: jsonrpc || "2.0",
        method: method || "eth_blockNumber",
        params: params || [],
        id: id || 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("1inch Web3 API error:", response.status, errorText);

      return NextResponse.json(
        {
          error: "Failed to fetch from 1inch Web3 API",
          status: response.status,
          message: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Web3 API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function to get transaction receipt
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get("chainId");
    const txHash = searchParams.get("txHash");
    const blockNumber = searchParams.get("blockNumber");
    const action = searchParams.get("action") || "receipt";

    if (!chainId) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    if (!INCH_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    let method = "eth_blockNumber";
    let params: any[] = [];

    switch (action) {
      case "receipt":
        if (!txHash) {
          return NextResponse.json(
            { error: "Transaction hash is required for receipt" },
            { status: 400 }
          );
        }
        method = "eth_getTransactionReceipt";
        params = [txHash];
        break;

      case "transaction":
        if (!txHash) {
          return NextResponse.json(
            { error: "Transaction hash is required for transaction" },
            { status: 400 }
          );
        }
        method = "eth_getTransactionByHash";
        params = [txHash];
        break;

      case "block":
        if (!blockNumber) {
          return NextResponse.json(
            { error: "Block number is required for block" },
            { status: 400 }
          );
        }
        method = "eth_getBlockByNumber";
        params = [blockNumber, true];
        break;

      case "balance":
        const address = searchParams.get("address");
        if (!address) {
          return NextResponse.json(
            { error: "Address is required for balance" },
            { status: 400 }
          );
        }
        method = "eth_getBalance";
        params = [address, "latest"];
        break;

      default:
        method = "eth_blockNumber";
        params = [];
    }

    const apiUrl = `${INCH_BASE_URL}/web3/${chainId}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("1inch Web3 API error:", response.status, errorText);

      return NextResponse.json(
        {
          error: "Failed to fetch from 1inch Web3 API",
          status: response.status,
          message: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Web3 API GET error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
