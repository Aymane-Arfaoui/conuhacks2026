"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

export interface LogData {
  timestamp: string;
  description: string;
  isDangerous: boolean;
  severity: number;
  location?: string;
}

export interface SummaryResult {
  summary: string;
  keyFindings: string[];
  riskAssessment: string;
  recommendations: string[];
  overallThreatLevel: 'low' | 'medium' | 'high' | 'critical';
  error?: string;
}

export async function summarizeLogs(logs: LogData[]): Promise<SummaryResult> {
  if (!genAI) {
    return {
      summary: "AI not configured. Add GEMINI_API_KEY to .env.local to enable AI-powered analysis.",
      keyFindings: ["API key not configured"],
      riskAssessment: "Unable to assess without AI",
      recommendations: ["Configure API key for full functionality"],
      overallThreatLevel: 'low'
    };
  }

  if (logs.length === 0) {
    return {
      summary: "No incident data available for analysis.",
      keyFindings: ["No events recorded"],
      riskAssessment: "No data to analyze",
      recommendations: ["Start monitoring to collect data"],
      overallThreatLevel: 'low'
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const dangerousCount = logs.filter(l => l.isDangerous).length;
    const totalCount = logs.length;
    const dangerRate = ((dangerousCount / totalCount) * 100).toFixed(1);

    const logsText = logs.slice(-50).map(l => 
      `[${l.timestamp}] ${l.isDangerous ? 'ALERT' : 'INFO'}: ${l.description}`
    ).join('\n');

    const prompt = `You are a security operations analyst reviewing surveillance system logs.

INCIDENT STATISTICS:
- Total Events: ${totalCount}
- Dangerous Events: ${dangerousCount}
- Danger Rate: ${dangerRate}%
- Time Period: ${logs[0]?.timestamp || 'N/A'} to ${logs[logs.length - 1]?.timestamp || 'N/A'}

RECENT LOGS:
${logsText}

Analyze these security logs and provide a professional assessment. Be concise but thorough.

RESPOND WITH JSON ONLY (no markdown code blocks):
{
  "summary": "2-3 sentence executive summary of the security situation",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "riskAssessment": "One paragraph assessing the overall risk level and patterns",
  "recommendations": ["action 1", "action 2", "action 3"],
  "overallThreatLevel": "low" or "medium" or "high" or "critical"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON
    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || "Analysis complete.",
      keyFindings: parsed.keyFindings || [],
      riskAssessment: parsed.riskAssessment || "Risk assessment unavailable.",
      recommendations: parsed.recommendations || [],
      overallThreatLevel: parsed.overallThreatLevel || 'medium'
    };

  } catch (error) {
    console.error('AI Summary error:', error);
    return {
      summary: "Unable to generate AI summary at this time.",
      keyFindings: ["Analysis error occurred"],
      riskAssessment: "Manual review recommended",
      recommendations: ["Check system logs", "Verify API connectivity"],
      overallThreatLevel: 'medium',
      error: String(error)
    };
  }
}

