import { prisma } from "@/lib/prisma";
import { fetchRecentEmails } from "@/lib/microsoft-graph";

const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export interface EmailDigestItem {
  id: string;
  microsoftId: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  receivedAt: string;
  webLink: string | null;
  clientLabel?: string | null;
  urgency?: "high" | "medium" | "low";
  aiReason?: string | null;
  isRead: boolean;
  daysAgo?: number;
}

const EMAIL_SCAN_TIMEZONE = "Asia/Bangkok";
const EMAIL_SCAN_LOOKBACK_DAYS = 7;
const EMAIL_SCAN_PAGE_SIZE = 100;
const EMAIL_SCAN_MAX_PAGES = 15;

function getLocalDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EMAIL_SCAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getLookbackStartDate(): Date {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - EMAIL_SCAN_LOOKBACK_DAYS);
  return start;
}

function buildInboxFilterSince(date: Date): string {
  // Note: When querying /me/mailFolders/inbox/messages the folder is already
  // scoped to Inbox — do NOT add parentFolderId filter (it is not supported
  // on this endpoint and causes Graph API to return 0 results).
  return `receivedDateTime ge ${date.toISOString()}`;
}

function stripHtml(input: string | null): string {
  if (!input) return "";
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Automated / No-Reply Detection ─────────────────────────────────────────
// Blocks clearly automated senders. Does NOT block generic business
// addresses like info@, support@, hello@ used by real clients.
const NO_REPLY_PATTERNS = [
  /no.?reply/i,
  /noreply/i,
  /do.?not.?reply/i,
  /donotreply/i,
  /^notification[s]?@/i,
  /^alert[s]?@/i,
  /^automated?@/i,
  /^mailer@/i,
  /^newsletter[s]?@/i,
  /^bulk@/i,
  /^bounce[d]?@/i,
  /^postmaster@/i,
  /@notifications\./i,
  /@alerts\./i,
  /@mg\./i,
  /@em[0-9]+\./i,
  /\.sendgrid\.net$/i,
  /\.mailchimp\.com$/i,
  /\.klaviyo\.com$/i,
  /\.constantcontact\.com$/i,
];

export function isNoReply(fromEmail: string | null, fromName: string | null): boolean {
  if (!fromEmail) return true;
  if (NO_REPLY_PATTERNS.some(p => p.test(fromEmail))) return true;
  if (fromName) {
    const name = fromName.toLowerCase();
    if (
      name.includes("no reply") ||
      name.includes("noreply") ||
      name.includes("do not reply") ||
      name.includes("automated") ||
      name.includes("newsletter") ||
      name.includes("mailer")
    ) return true;
  }
  return false;
}

// ─── Subject-level automation detection ─────────────────────────────────────
// Catches calendar accept/decline, system notifications, receipts, etc.
const AUTOMATED_SUBJECT_PATTERNS = [
  /^accepted:/i,
  /^declined:/i,
  /^tentative:/i,
  /^cancelled:/i,
  /^automatic reply:/i,
  /^out of office/i,
  /^delivery (status notification|failure|report)/i,
  /^undeliverable/i,
  /^read receipt/i,
  /^meeting request/i,   // calendar invite auto-response
  /^invitation:/i,
  /^\[jira\]/i,
  /^\[github\]/i,
  /^\[gitlab\]/i,
  /^\[confluence\]/i,
  /^\[slack\]/i,
  /^\[trello\]/i,
];

function isAutomatedSubject(subject: string | null): boolean {
  if (!subject) return false;
  return AUTOMATED_SUBJECT_PATTERNS.some(p => p.test(subject.trim()));
}

// ─── Internal / Colleague Detection ─────────────────────────────────────────
// Emails from the same company domain are treated as "internal" — they still
// get classified (they can be missed/needs-reply) but are labelled "Internal"
// instead of "External". Only truly automated senders (no-reply / noreply)
// are excluded entirely at this stage.
const INTERNAL_DOMAIN = "saigontechnology.com";

// shouldExcludeEmail: ONLY exclude automated / no-reply senders.
// Do NOT exclude internal domain here — internal emails can still need action.
export function shouldExcludeEmail(fromEmail: string | null): boolean {
  if (!fromEmail) return true;
  const email = fromEmail.toLowerCase().trim();
  return (
    email.includes("no-reply")
    || email.includes("noreply")
  );
}

function isInternalSender(fromEmail: string | null): boolean {
  if (!fromEmail) return false;
  return fromEmail.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`);
}

export function detectClientEmail(
  fromEmail: string | null,
  fromName: string | null,
  _rules: { type: string; value: string; name: string; label: string | null }[]
): { isClient: boolean; label: string | null } {
  void fromName;
  void _rules;
  if (!fromEmail) return { isClient: false, label: null };

  const email = fromEmail.toLowerCase().trim();

  // Exclude automated / no-reply senders entirely
  if (shouldExcludeEmail(email)) {
    return { isClient: false, label: null };
  }

  // Internal senders are still valid — label them so the UI can distinguish
  if (isInternalSender(email)) {
    return { isClient: true, label: "Internal" };
  }

  return { isClient: true, label: "External" };
}

// ─── Rule-based Urgency ──────────────────────────────────────────────────────
// Determines urgency purely from email metadata — no AI needed.
function ruleBasedUrgency(
  email: {
    importance: "low" | "normal" | "high";
    subject: string | null;
    hasAttachments: boolean;
    daysAgo: number;
    isRead: boolean;
    fromEmail: string | null;
  }
): "high" | "medium" | "low" {
  // Explicit high importance flag from sender
  if (email.importance === "high") return "high";

  // Old unread (≥ 3 days) is always high — definitely missed
  if (!email.isRead && email.daysAgo >= 3) return "high";

  // Subject signals
  const subjectLower = (email.subject ?? "").toLowerCase();
  const highUrgencySubjectSignals = [
    "urgent", "asap", "immediately", "critical", "action required",
    "deadline", "overdue", "final notice", "last chance",
    "invoice", "payment", "contract", "agreement", "sign",
    "approval needed", "please approve", "waiting for your",
  ];
  if (highUrgencySubjectSignals.some(s => subjectLower.includes(s))) return "high";

  // Low importance flag
  if (email.importance === "low") return "low";

  return "medium";
}

// ─── Rule-based Classification ───────────────────────────────────────────────
// Returns which bucket an email belongs to, and the reason.
// Priority order: missed_reply > needs_reply > follow_up > read_again > none
function classifyByRules(email: {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  bodyPreview: string | null;
  bodyContent: string | null;
  receivedDateTime: Date;
  isRead: boolean;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  daysAgo: number;
}): {
  bucket: "missed_reply" | "needs_reply" | "follow_up" | "read_again" | "none";
  reason: string;
} {
  // ── Automated subject → none ──────────────────────────────────────────────
  if (isAutomatedSubject(email.subject)) {
    return { bucket: "none", reason: "Automated system message" };
  }

  // ── UNREAD emails → missed_reply or needs_reply ───────────────────────────
  // Any unread email from a real person always falls in these two buckets.
  // We do NOT silently drop unread emails.
  if (!email.isRead) {
    if (email.daysAgo >= 1) {
      return {
        bucket: "missed_reply",
        reason: email.daysAgo >= 3
          ? `Unread for ${email.daysAgo} days — likely missed`
          : `Unread since yesterday — needs your attention`,
      };
    }
    // Received today
    return {
      bucket: "needs_reply",
      reason: "Unread email received today — reply expected",
    };
  }

  // ── READ emails → follow_up or read_again or none ─────────────────────────
  const bodyText = `${email.subject ?? ""} ${email.bodyPreview ?? ""} ${stripHtml(email.bodyContent ?? null)}`.toLowerCase();

  // follow_up signals: you sent something and are waiting for a response
  const followUpSignals = [
    "following up",
    "just checking in",
    "checking in",
    "any update",
    "any news",
    "as discussed",
    "per our conversation",
    "waiting for",
    "pending your",
    "please let me know",
    "could you please",
    "can you please",
    "would you be able",
    "have you had a chance",
    "did you get a chance",
  ];
  if (followUpSignals.some(s => bodyText.includes(s))) {
    return { bucket: "follow_up", reason: "Email requires a follow-up or response" };
  }

  // read_again signals: attachments, proposals, contracts, specs
  const readAgainSignals = [
    "please review", "for your review", "review attached",
    "see attached", "attached proposal", "attached scope",
    "attached contract", "please check", "let me know your thoughts",
    "feedback", "requirements", "quotation", "proposal",
    "contract", "draft", "specifications", "scope of work",
  ];
  if (
    email.hasAttachments ||
    email.importance === "high" ||
    readAgainSignals.some(s => bodyText.includes(s))
  ) {
    return { bucket: "read_again", reason: "Contains attachments or important content to review" };
  }

  return { bucket: "none", reason: "No action required" };
}

// ─── Dedup by conversationId ─────────────────────────────────────────────────
// For emails in the same thread, only keep the most recent one.
// This prevents 1 thread with 5 replies showing as 5 separate action items.
function dedupByThread<T extends { id: string; receivedDateTime: Date; conversationId?: string | null }>(
  emails: T[]
): T[] {
  const seen = new Map<string, T>();
  for (const email of emails) {
    const key = email.conversationId ?? email.id;
    const existing = seen.get(key);
    if (!existing || email.receivedDateTime > existing.receivedDateTime) {
      seen.set(key, email);
    }
  }
  return Array.from(seen.values());
}

// ─── AI Summary (kept — summary ≠ classify) ──────────────────────────────────
export async function generateAISummary(
  apiKey: string,
  missed: EmailDigestItem[],
  needsReply: EmailDigestItem[],
  followUp: EmailDigestItem[],
  readAgain: EmailDigestItem[]
): Promise<string> {
  const total = missed.length + needsReply.length + followUp.length + readAgain.length;
  if (total === 0) return "📭 Inbox clear — no important emails need attention from the last 7 days.";

  const context = [
    missed.length > 0 ? `${missed.length} email${missed.length > 1 ? "s" : ""} you likely missed replying to` : null,
    needsReply.length > 0 ? `${needsReply.length} new email${needsReply.length > 1 ? "s" : ""} needing a reply` : null,
    followUp.length > 0 ? `${followUp.length} follow-up${followUp.length > 1 ? "s" : ""} to check on` : null,
    readAgain.length > 0 ? `${readAgain.length} email${readAgain.length > 1 ? "s" : ""} worth reading again` : null,
  ].filter(Boolean).join(", ");

  const urgentMissed = missed.filter(e => e.daysAgo && e.daysAgo >= 2);
  const urgentReply = needsReply.filter(e => e.urgency === "high");

  try {
    const res = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPINFRA_MODEL,
        messages: [{ role: "user", content: `Write a concise 2-sentence actionable email summary for a professional. Last 7 days scan: ${context}.${urgentMissed.length > 0 ? ` Most urgent: ${urgentMissed.slice(0, 2).map(e => `"${e.subject ?? "email"}" from ${e.fromName ?? e.fromEmail} (${e.daysAgo}d ago)`).join(", ").trim()}.` : ""}${urgentReply.length > 0 ? ` High priority: ${urgentReply.slice(0, 2).map(e => `"${e.subject}" from ${e.fromName ?? e.fromEmail}`).join(", ")}.` : ""} Be direct and action-oriented. Start with an emoji.` }],
        max_tokens: 150,
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() ?? buildFallbackSummary(missed, needsReply, followUp, readAgain);
  } catch {
    return buildFallbackSummary(missed, needsReply, followUp, readAgain);
  }
}

export function buildFallbackSummary(
  missed: EmailDigestItem[], needsReply: EmailDigestItem[], followUp: EmailDigestItem[], readAgain: EmailDigestItem[]
): string {
  const parts: string[] = [];
  if (missed.length > 0) parts.push(`⚠️ ${missed.length} email${missed.length > 1 ? "s" : ""} may be awaiting your reply`);
  if (needsReply.length > 0) parts.push(`📬 ${needsReply.length} email${needsReply.length > 1 ? "s" : ""} need a response`);
  if (followUp.length > 0) parts.push(`🔄 ${followUp.length} follow-up${followUp.length > 1 ? "s" : ""} to check on`);
  if (readAgain.length > 0) parts.push(`📖 ${readAgain.length} email${readAgain.length > 1 ? "s" : ""} deserve another read`);
  return parts.join(" · ") || "✅ Inbox looks good!";
}

// ─── Main Scan Logic ──────────────────────────────────────────────────────────
export async function runEmailScan(userId: string): Promise<void> {
  const connection = await prisma.microsoftConnection.findUnique({
    where: { userId },
  });
  if (!connection) throw new Error("Microsoft not connected");

  const today = getLocalDateKey();

  let digest = await prisma.emailDigest.findFirst({
    where: { userId, scanDate: today },
    orderBy: { createdAt: "desc" },
  });

  if (!digest) {
    digest = await prisma.emailDigest.create({
      data: {
        userId,
        connectionId: connection.id,
        scanDate: today,
        status: "running",
        startedAt: new Date(),
      },
    });
  } else {
    await prisma.emailDigest.update({
      where: { id: digest.id },
      data: { status: "running", startedAt: new Date(), errorMessage: null },
    });
  }

  try {
    const rules = await prisma.emailScanRule.findMany({
      where: { userId, isActive: true },
    });

    const lookbackStart = getLookbackStartDate();
    const rawEmails = await fetchRecentEmails(userId, {
      top: EMAIL_SCAN_PAGE_SIZE,
      filter: buildInboxFilterSince(lookbackStart),
      fetchAll: true,
      maxPages: EMAIL_SCAN_MAX_PAGES,
    });

    const now = new Date();
    let noReplyFiltered = 0;
    let automatedFiltered = 0;

    // ── Step 1: filter no-reply / automated senders ──────────────────────────
    const humanEmails: typeof rawEmails = [];
    for (const email of rawEmails) {
      // isNoReply already covers most patterns; shouldExcludeEmail covers
      // additional noreply variants not caught by display-name checks.
      if (
        isNoReply(email.from?.email ?? null, email.from?.name ?? null) ||
        shouldExcludeEmail(email.from?.email ?? null)
      ) {
        noReplyFiltered++;
        continue;
      }
      // Automated subject lines (calendar responses, OOO, etc.)
      if (isAutomatedSubject(email.subject)) {
        automatedFiltered++;
        continue;
      }
      humanEmails.push(email);
    }

    console.log(
      `[EmailScan] user=${userId} rawFetched=${rawEmails.length}` +
      ` noReplyFiltered=${noReplyFiltered} automatedFiltered=${automatedFiltered}` +
      ` humanEmails=${humanEmails.length}`
    );

    // ── Step 2: dedup threads — keep latest email per conversation ───────────
    // Attach daysAgo for dedup, then dedup
    const withMeta = humanEmails.map(e => ({
      ...e,
      conversationId: (e as unknown as Record<string, unknown>).conversationId as string | null ?? null,
      daysAgo: Math.floor((now.getTime() - e.receivedDateTime.getTime()) / 86400000),
    }));
    const dedupedEmails = dedupByThread(withMeta);

    // ── Step 3: apply detectClientEmail (respects user-defined rules) ─────────
    const clientEmails = dedupedEmails.filter(e => {
      const { isClient } = detectClientEmail(
        e.from?.email ?? null,
        e.from?.name ?? null,
        rules
      );
      return isClient;
    });

    // ── Step 4: pure rule-based classification ───────────────────────────────
    const missedReplies: EmailDigestItem[] = [];
    const needsReply: EmailDigestItem[] = [];
    const followUp: EmailDigestItem[] = [];
    const readAgain: EmailDigestItem[] = [];

    for (const email of clientEmails) {
      const daysAgo = email.daysAgo;
      const internal = isInternalSender(email.from?.email ?? null);

      const { bucket, reason } = classifyByRules({
        id: email.id,
        subject: email.subject,
        fromEmail: email.from?.email ?? null,
        fromName: email.from?.name ?? null,
        bodyPreview: email.bodyPreview,
        bodyContent: email.bodyContent,
        receivedDateTime: email.receivedDateTime,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        importance: email.importance,
        daysAgo,
      });

      if (bucket === "none") continue;

      const urgency = ruleBasedUrgency({
        importance: email.importance,
        subject: email.subject,
        hasAttachments: email.hasAttachments,
        daysAgo,
        isRead: email.isRead,
        fromEmail: email.from?.email ?? null,
      });

      const item: EmailDigestItem = {
        id: email.id,
        microsoftId: email.id,
        subject: email.subject,
        fromEmail: email.from?.email ?? null,
        fromName: email.from?.name ?? null,
        receivedAt: email.receivedDateTime.toISOString(),
        webLink: email.webLink,
        clientLabel: internal ? "Internal" : "External",
        urgency,
        aiReason: reason,
        isRead: email.isRead,
        daysAgo,
      };

      if (bucket === "missed_reply") missedReplies.push(item);
      else if (bucket === "needs_reply") needsReply.push(item);
      else if (bucket === "follow_up") followUp.push(item);
      else if (bucket === "read_again") readAgain.push(item);
    }

    // ── Step 5: sort each bucket — urgency desc, then daysAgo desc ───────────
    const sortItems = (items: EmailDigestItem[]) =>
      items.sort((a, b) => {
        const urgencyScore = { high: 3, medium: 2, low: 1 };
        const diff = (urgencyScore[b.urgency ?? "medium"] ?? 2) - (urgencyScore[a.urgency ?? "medium"] ?? 2);
        if (diff !== 0) return diff;
        return (b.daysAgo ?? 0) - (a.daysAgo ?? 0);
      });

    sortItems(missedReplies);
    sortItems(needsReply);
    sortItems(followUp);
    sortItems(readAgain);

    // ── Step 6: AI summary (optional — does not affect bucket counts) ─────────
    const apiKey = process.env.DEEPINFRA_API_KEY;
    const aiSummary = apiKey
      ? await generateAISummary(apiKey, missedReplies, needsReply, followUp, readAgain)
      : buildFallbackSummary(missedReplies, needsReply, followUp, readAgain);

    console.log(
      `[EmailScan] user=${userId} raw=${rawEmails.length} noReply=${noReplyFiltered}` +
      ` automated=${automatedFiltered} deduped=${dedupedEmails.length}` +
      ` client=${clientEmails.length}` +
      ` missed=${missedReplies.length} needs=${needsReply.length}` +
      ` followUp=${followUp.length} readAgain=${readAgain.length}`
    );

    await (prisma.emailDigest.update as Function)({
      where: { id: digest.id },
      data: {
        totalScanned: rawEmails.length,
        clientEmailCount: clientEmails.length,
        noReplyFiltered: noReplyFiltered + automatedFiltered,
        missedReplyCount: missedReplies.length,
        needsReplyCount: needsReply.length,
        followUpCount: followUp.length,
        readAgainCount: readAgain.length,
        missedReplies: JSON.stringify(missedReplies.slice(0, 20)),
        needsReply: JSON.stringify(needsReply.slice(0, 20)),
        followUp: JSON.stringify(followUp.slice(0, 20)),
        readAgain: JSON.stringify(readAgain.slice(0, 20)),
        aiSummary,
        status: "done",
        completedAt: new Date(),
      },
    });

    await prisma.microsoftConnection.update({
      where: { userId },
      data: { lastEmailSyncAt: new Date() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.emailDigest.update({
      where: { id: digest.id },
      data: { status: "error", errorMessage: msg, completedAt: new Date() },
    });
    throw err;
  }
}
