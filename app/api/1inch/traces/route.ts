import { NextRequest, NextResponse } from "next/server";

const INCH_API_KEY = process.env.INCH_API_KEY;
const INCH_BASE_URL = "https://api.1inch.dev";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get("chain");
    const blockNumber = searchParams.get("blockNumber");
    const txHash = searchParams.get("txHash");
    const offset = searchParams.get("offset");

    if (!chain) {
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

    let apiUrl = `${INCH_BASE_URL}/traces/v1.0/chain/${chain}`;

    if (blockNumber && txHash) {
      // Get specific transaction trace
      apiUrl += `/block-trace/${blockNumber}/tx-hash/${txHash}`;
    } else if (blockNumber && offset) {
      // Get transaction by block and offset
      apiUrl += `/block-trace/${blockNumber}/offset/${offset}`;
    } else if (blockNumber) {
      // Get all traces for a block
      apiUrl += `/block-trace/${blockNumber}`;
    } else {
      // Get synced interval
      apiUrl += "/synced-interval";
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${INCH_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("1inch API error:", response.status, errorText);

      return NextResponse.json(
        {
          error: "Failed to fetch from 1inch API",
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
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Traces API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, method, params } = body;

    if (!chain || !method) {
      return NextResponse.json(
        { error: "Chain and method are required" },
        { status: 400 }
      );
    }

    if (!INCH_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const apiUrl = `${INCH_BASE_URL}/traces/v1.0/chain/${chain}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params: params || [],
        id: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("1inch Traces API error:", response.status, errorText);

      return NextResponse.json(
        {
          error: "Failed to fetch from 1inch Traces API",
          status: response.status,
          message: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Traces API POST error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
