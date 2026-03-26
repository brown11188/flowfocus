import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    rules: [],
    mode: "fixed_exclusions",
    exclusions: [
      "contains:no-reply",
      "contains:noreply",
      "domain:saiogntechnology.com",
    ],
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Dynamic email rules are disabled. FlowFocus now uses fixed exclusions: no-reply, noreply, and @saiogntechnology.com.",
    },
    { status: 400 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Dynamic email rules are disabled. FlowFocus now uses fixed exclusions: no-reply, noreply, and @saiogntechnology.com.",
    },
    { status: 400 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: "Dynamic email rules are disabled. FlowFocus now uses fixed exclusions: no-reply, noreply, and @saiogntechnology.com.",
    },
    { status: 400 },
  );
}
