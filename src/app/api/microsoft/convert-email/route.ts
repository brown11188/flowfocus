import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { microsoftConnections, emailTasks, tasks, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { fetchEmailById } from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

interface EmailAnalysis {
  summary: string;
  suggestedPriority: 1 | 2 | 3 | 4;
  suggestedDueDate: string | null; // ISO date or null
  suggestedProject: string | null;
  actionItems: string[];
  category: "work" | "personal" | "finance" | "meeting" | "other";
}

/**
 * POST /api/microsoft/convert-email
 * Convert an email to a task with AI analysis
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { emailId, microsoftId, customTitle, customPriority, customDueDate, projectId } = body;

  // Get email either by ID or Microsoft ID
  let emailTask = null;
  let emailData = null;

  if (emailId) {
    emailTask = await db.select().from(emailTasks)
      .where(and(eq(emailTasks.id, emailId), eq(emailTasks.userId, session.user.id)))
      .limit(1).then(r => r[0] ?? null);
  } else if (microsoftId) {
    emailTask = await db.select().from(emailTasks)
      .where(and(eq(emailTasks.microsoftId, microsoftId), eq(emailTasks.userId, session.user.id)))
      .limit(1).then(r => r[0] ?? null);
  }

  if (emailTask) {
    // Fetch full email content from Microsoft Graph
    emailData = await fetchEmailById(session.user.id, emailTask.microsoftId);
  } else if (microsoftId) {
    // Direct fetch from Microsoft if not in DB
    emailData = await fetchEmailById(session.user.id, microsoftId);
  }

  if (!emailTask && !emailData) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const connection = await db.select().from(microsoftConnections)
    .where(eq(microsoftConnections.userId, session.user.id)).limit(1).then(r => r[0] ?? null);

  if (!connection) {
    return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });
  }

  // Get user's projects for AI context
  const projectsList = await db.select({ id: projects.id, name: projects.name })
    .from(projects).where(eq(projects.userId, session.user.id)).limit(20);

  const subject = emailData?.subject ?? emailTask?.subject ?? "Untitled Task";
  const bodyContent = emailData?.bodyContent ?? emailTask?.preview ?? "";
  const fromEmail = emailData?.from?.email ?? emailTask?.fromEmail ?? "";
  const fromName = emailData?.from?.name ?? emailTask?.fromName ?? "";

  // AI Analysis
  let analysis: EmailAnalysis = {
    summary: "",
    suggestedPriority: 4,
    suggestedDueDate: null,
    suggestedProject: null,
    actionItems: [],
    category: "other",
  };

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (apiKey) {
    try {
      analysis = await analyzeEmailWithAI(
        apiKey,
        subject,
        bodyContent,
        fromEmail,
        fromName,
        projectsList.map((p) => p.name)
      );
    } catch (error) {
      console.error("[Microsoft] AI analysis failed:", error);
      // Continue with defaults
    }
  }

  // Determine task properties
  const taskTitle = customTitle ?? analysis.actionItems[0] ?? subject;
  const taskPriority = customPriority ?? analysis.suggestedPriority;
  const taskDueDate = customDueDate ? new Date(customDueDate) : analysis.suggestedDueDate ? new Date(analysis.suggestedDueDate) : null;

  // Find or use project
  let taskProjectId = projectId;
  if (!taskProjectId && analysis.suggestedProject) {
    const matchedProject = projectsList.find(
      (p) => p.name.toLowerCase() === analysis.suggestedProject?.toLowerCase()
    );
    if (matchedProject) taskProjectId = matchedProject.id;
  }

  const [task] = await db.insert(tasks).values({
    id: createId(),
    title: taskTitle,
    notes: `**From:** ${fromName} <${fromEmail}>\n**Subject:** ${subject}\n\n${analysis.summary}\n\n**Action Items:**\n${analysis.actionItems.map((a) => `- ${a}`).join("\\n")}\n\n---\n${bodyContent.slice(0, 2000)}`,
    priority: taskPriority,
    dueDate: taskDueDate,
    projectId: taskProjectId,
    userId: session.user.id,
  }).returning();

  if (emailTask) {
    await db.update(emailTasks).set({
      status: "converted",
      convertedTaskId: task.id,
      convertedAt: new Date(),
      aiSummary: analysis.summary,
      suggestedPriority: analysis.suggestedPriority,
      suggestedDueDate: analysis.suggestedDueDate ? new Date(analysis.suggestedDueDate) : null,
    }).where(eq(emailTasks.id, emailTask.id));
  } else if (microsoftId) {
    await db.insert(emailTasks).values({
      id: createId(),
      connectionId: connection!.id,
      userId: session.user.id,
      microsoftId,
      subject,
      fromEmail,
      fromName,
      receivedAt: emailData?.receivedDateTime ?? new Date(),
      preview: bodyContent.slice(0, 500),
      webLink: emailData?.webLink ?? null,
      status: "converted",
      convertedTaskId: task.id,
      convertedAt: new Date(),
      aiSummary: analysis.summary,
      suggestedPriority: analysis.suggestedPriority,
      suggestedDueDate: analysis.suggestedDueDate ? new Date(analysis.suggestedDueDate) : null,
    });
  }

  return NextResponse.json({
    success: true,
    task,
    analysis,
    emailLink: emailData?.webLink ?? emailTask?.webLink,
  });
}

/**
 * Analyze email with DeepInfra AI
 */
async function analyzeEmailWithAI(
  apiKey: string,
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string,
  projectNames: string[]
): Promise<EmailAnalysis> {
  const prompt = `You are an AI assistant that analyzes emails and extracts task information.

Analyze this email and provide:
1. A concise 1-2 sentence summary
2. Suggested priority (1=Urgent, 2=High, 3=Medium, 4=Low)
3. Suggested due date (ISO format if applicable, or null)
4. Best matching project from the list (or null)
5. Action items extracted from the email
6. Category (work, personal, finance, meeting, other)

**Email From:** ${fromName} <${fromEmail}>
**Subject:** ${subject}
**Body:**
${body.slice(0, 3000)}

**Available Projects:** ${projectNames.join(", ") || "None"}

Respond with JSON only:
{
  "summary": "Brief summary of the email",
  "suggestedPriority": 1-4,
  "suggestedDueDate": "YYYY-MM-DD or null",
  "suggestedProject": "project name or null",
  "actionItems": ["First action", "Second action"],
  "category": "work|personal|finance|meeting|other"
}`;

  const response = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPINFRA_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepInfra error: ${response.status}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices[0]?.message?.content ?? "{}";

  // Parse JSON
  let cleaned = content.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "",
      suggestedPriority: Math.min(4, Math.max(1, parsed.suggestedPriority ?? 4)) as 1 | 2 | 3 | 4,
      suggestedDueDate: parsed.suggestedDueDate ?? null,
      suggestedProject: parsed.suggestedProject ?? null,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      category: parsed.category ?? "other",
    };
  } catch {
    return {
      summary: "",
      suggestedPriority: 4,
      suggestedDueDate: null,
      suggestedProject: null,
      actionItems: [],
      category: "other",
    };
  }
}
