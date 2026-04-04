import { db } from '../src/db/index.js'
import { users, projects, labels, tasks, taskLabels } from '../src/db/schema.js'
import { eq, and } from 'drizzle-orm'

// Pre-computed bcrypt hash for "password123" (cost 12)
const DEMO_PASSWORD_HASH = "$2b$12$1OT3gZ8bRWXqq1SZfznox.kAOVBWOFjK2BPXTIGFo2tKL56OuwHuu";

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Demo User
  let [user] = await db.select().from(users).where(eq(users.email, "demo@flowfocus.app")).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      name: "Demo User",
      email: "demo@flowfocus.app",
      password: DEMO_PASSWORD_HASH,
    }).returning();
  }
  console.log(`  ✅ User: ${user.name} (${user.email})`);

  // 2. Inbox project
  let [inbox] = await db.select().from(projects).where(and(eq(projects.userId, user.id), eq(projects.isInbox, true))).limit(1);
  if (!inbox) {
    [inbox] = await db.insert(projects).values({
      id: "proj-inbox",
      name: "Inbox",
      color: "#6366f1",
      userId: user.id,
      isInbox: true,
      sortOrder: 0,
    }).returning();
  }
  console.log("  ✅ Inbox project");

  console.log("✅ Seed complete!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
