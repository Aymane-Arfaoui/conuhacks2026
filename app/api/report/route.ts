import { NextRequest, NextResponse } from "next/server";

interface Event {
  type: string;
  severity: number;
  label: string;
  track_id: number;
  timestamp?: number;
}

interface ReportRequest {
  events: Event[];
  startTime?: number;
  endTime?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportRequest = await request.json();
    const { events, startTime, endTime } = body;

    if (!events || events.length === 0) {
      return NextResponse.json({ error: "No events provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const report = generateSimpleReport(events, startTime, endTime);
      return NextResponse.json({ report, source: "local" });
    }

    const report = await generateAIReport(apiKey, events, startTime, endTime);
    return NextResponse.json({ report, source: "openai" });
  } catch (error) {
    console.error("[Report] Error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

function generateSimpleReport(events: Event[], startTime?: number, endTime?: number): string {
  const now = new Date();
  const start = startTime ? new Date(startTime) : now;
  const end = endTime ? new Date(endTime) : now;

  const byType: Record<string, Event[]> = {};
  for (const event of events) {
    if (!byType[event.type]) byType[event.type] = [];
    byType[event.type].push(event);
  }

  let report = `# EyeWatch Incident Report\n\n`;
  report += `**Generated:** ${now.toISOString()}\n`;
  report += `**Period:** ${start.toLocaleString()} - ${end.toLocaleString()}\n`;
  report += `**Total Events:** ${events.length}\n\n`;
  report += `## Summary\n\n`;

  for (const [type, typeEvents] of Object.entries(byType)) {
    const highSeverity = typeEvents.filter((e) => e.severity >= 3).length;
    report += `- **${type}**: ${typeEvents.length} occurrences`;
    if (highSeverity > 0) report += ` (${highSeverity} high severity)`;
    report += `\n`;
  }

  report += `\n## Event Details\n\n`;
  for (const event of events.slice(0, 20)) {
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "N/A";
    report += `- [${time}] **${event.type}** (Severity ${event.severity}): ${event.label}\n`;
  }

  if (events.length > 20) report += `\n*...and ${events.length - 20} more events*\n`;
  return report;
}

async function generateAIReport(apiKey: string, events: Event[], startTime?: number, endTime?: number): Promise<string> {
  const prompt = `You are a security analyst. Generate a professional incident report based on these surveillance events.

Events detected:
${JSON.stringify(events.slice(0, 50), null, 2)}

Period: ${startTime ? new Date(startTime).toISOString() : "N/A"} to ${endTime ? new Date(endTime).toISOString() : "N/A"}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Risk Assessment (Low/Medium/High)
4. Recommended Actions

Format as Markdown.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional security analyst writing incident reports." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  // yo

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || "Failed to generate report.";
}

