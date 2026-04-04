import { PrismaClient } from '../src/generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Pre-computed bcrypt hash for "password123" (cost 12)
const DEMO_PASSWORD_HASH = "$2b$12$1OT3gZ8bRWXqq1SZfznox.kAOVBWOFjK2BPXTIGFo2tKL56OuwHuu";

async function main() {
  console.log("🌱 Seeding database...");

  // ---------------------------------------------------------------------------
  // 1. Demo User
  // ---------------------------------------------------------------------------
  const hashedPassword = DEMO_PASSWORD_HASH;

  const user = await prisma.user.upsert({
    where: { email: "demo@flowfocus.app" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@flowfocus.app",
      password: hashedPassword,
    },
  });
  console.log(`  ✅ User: ${user.name} (${user.email})`);

  // ---------------------------------------------------------------------------
  // 2. Projects
  // ---------------------------------------------------------------------------
  const inbox = await prisma.project.upsert({
    where: { id: "proj-inbox" },
    update: {},
    create: {
      id: "proj-inbox",
      name: "Inbox",
      color: "#6366f1",
      userId: user.id,
      isInbox: true,
      sortOrder: 0,
    },
  });

  const work = await prisma.project.upsert({
    where: { id: "proj-work" },
    update: {},
    create: {
      id: "proj-work",
      name: "Work",
      color: "#f59e0b",
      userId: user.id,
      isInbox: false,
      sortOrder: 1,
    },
  });

  const personal = await prisma.project.upsert({
    where: { id: "proj-personal" },
    update: {},
    create: {
      id: "proj-personal",
      name: "Personal",
      color: "#10b981",
      userId: user.id,
      isInbox: false,
      sortOrder: 2,
    },
  });

  const learning = await prisma.project.upsert({
    where: { id: "proj-learning" },
    update: {},
    create: {
      id: "proj-learning",
      name: "Learning",
      color: "#8b5cf6",
      userId: user.id,
      isInbox: false,
      sortOrder: 3,
    },
  });

  console.log(`  ✅ Projects: ${[inbox, work, personal, learning].map((p) => p.name).join(", ")}`);

  // ---------------------------------------------------------------------------
  // 3. Labels
  // ---------------------------------------------------------------------------
  const labels = await Promise.all(
    [
      { id: "lbl-bug", name: "Bug", color: "#ef4444" },
      { id: "lbl-feature", name: "Feature", color: "#3b82f6" },
      { id: "lbl-urgent", name: "Urgent", color: "#f97316" },
      { id: "lbl-review", name: "Review", color: "#a855f7" },
      { id: "lbl-health", name: "Health", color: "#10b981" },
    ].map((l) =>
      prisma.label.upsert({
        where: { id: l.id },
        update: {},
        create: { ...l, userId: user.id },
      })
    )
  );
  console.log(`  ✅ Labels: ${labels.map((l) => l.name).join(", ")}`);

  // ---------------------------------------------------------------------------
  // 4. Tasks – mix of due dates, priorities, and statuses
  // ---------------------------------------------------------------------------
  const today = new Date();
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  const tasks = [
    // Today tasks
    {
      id: "task-1",
      title: "Review pull request #142",
      notes: "Check the new auth middleware changes and ensure tests pass.",
      dueDate: today,
      dueTime: "10:00",
      priority: 1,
      projectId: work.id,
      labelIds: ["lbl-review", "lbl-urgent"],
    },
    {
      id: "task-2",
      title: "Fix login redirect bug",
      notes: "Users are getting redirected to 404 after OAuth login.",
      dueDate: today,
      priority: 1,
      projectId: work.id,
      labelIds: ["lbl-bug", "lbl-urgent"],
    },
    {
      id: "task-3",
      title: "Go for a 30min run",
      dueDate: today,
      dueTime: "07:00",
      priority: 2,
      projectId: personal.id,
      labelIds: ["lbl-health"],
    },
    {
      id: "task-4",
      title: "Buy groceries",
      notes: "Milk, eggs, bread, chicken, vegetables.",
      dueDate: today,
      priority: 3,
      projectId: personal.id,
      labelIds: [],
    },

    // Tomorrow tasks
    {
      id: "task-5",
      title: "Write tech spec for notifications feature",
      notes: "Include push notifications, email digests, and in-app alerts.",
      dueDate: addDays(today, 1),
      priority: 2,
      projectId: work.id,
      labelIds: ["lbl-feature"],
    },
    {
      id: "task-6",
      title: "Read Chapter 5 of Designing Data-Intensive Apps",
      dueDate: addDays(today, 1),
      priority: 3,
      projectId: learning.id,
      labelIds: [],
    },

    // This week tasks
    {
      id: "task-7",
      title: "Prepare sprint demo presentation",
      dueDate: addDays(today, 3),
      priority: 2,
      projectId: work.id,
      labelIds: [],
    },
    {
      id: "task-8",
      title: "Schedule dentist appointment",
      dueDate: addDays(today, 4),
      priority: 4,
      projectId: personal.id,
      labelIds: ["lbl-health"],
    },
    {
      id: "task-9",
      title: "Complete TypeScript generics tutorial",
      notes: "Focus on conditional types and mapped types.",
      dueDate: addDays(today, 5),
      priority: 3,
      projectId: learning.id,
      labelIds: [],
    },

    // Next week tasks
    {
      id: "task-10",
      title: "Deploy v2.0 to staging",
      dueDate: addDays(today, 7),
      priority: 1,
      projectId: work.id,
      labelIds: ["lbl-feature"],
    },
    {
      id: "task-11",
      title: "Plan weekend hiking trip",
      notes: "Research trails within 2 hours drive. Book campsite.",
      dueDate: addDays(today, 10),
      priority: 4,
      projectId: personal.id,
      labelIds: [],
    },

    // No due date (Inbox)
    {
      id: "task-12",
      title: "Explore Bun runtime for side projects",
      notes: "Compare performance with Node.js and check ecosystem compatibility.",
      priority: 4,
      projectId: inbox.id,
      labelIds: [],
    },
    {
      id: "task-13",
      title: "Update resume with latest project experience",
      priority: 3,
      projectId: inbox.id,
      labelIds: [],
    },

    // Completed tasks (for stats)
    {
      id: "task-14",
      title: "Set up CI/CD pipeline",
      dueDate: addDays(today, -2),
      priority: 1,
      projectId: work.id,
      completed: true,
      completedAt: addDays(today, -2),
      labelIds: ["lbl-feature"],
    },
    {
      id: "task-15",
      title: "Write unit tests for auth module",
      dueDate: addDays(today, -1),
      priority: 2,
      projectId: work.id,
      completed: true,
      completedAt: addDays(today, -1),
      labelIds: ["lbl-review"],
    },
    {
      id: "task-16",
      title: "Morning yoga session",
      dueDate: addDays(today, -1),
      priority: 3,
      projectId: personal.id,
      completed: true,
      completedAt: addDays(today, -1),
      labelIds: ["lbl-health"],
    },
  ];

  for (const task of tasks) {
    const { labelIds, ...taskData } = task;

    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: taskData.id,
        title: taskData.title,
        notes: taskData.notes ?? null,
        dueDate: taskData.dueDate ?? null,
        dueTime: taskData.dueTime ?? null,
        priority: taskData.priority,
        completed: taskData.completed ?? false,
        completedAt: taskData.completedAt ?? null,
        sortOrder: tasks.indexOf(task),
        userId: user.id,
        projectId: taskData.projectId,
      },
    });

    // Attach labels
    if (labelIds.length > 0) {
      await Promise.all(
        labelIds.map((labelId) =>
          prisma.taskLabel.upsert({
            where: { taskId_labelId: { taskId: task.id, labelId } },
            update: {},
            create: { taskId: task.id, labelId },
          })
        )
      );
    }
  }

  console.log(`  ✅ Tasks: ${tasks.length} created (${tasks.filter((t) => t.completed).length} completed)`);

  // ---------------------------------------------------------------------------
  // 5. Sub-tasks demo
  // ---------------------------------------------------------------------------
  const subtasks = [
    {
      id: "task-5-sub-1",
      title: "Draft notification schema",
      parentId: "task-5",
      priority: 2,
      projectId: work.id,
      sortOrder: 0,
    },
    {
      id: "task-5-sub-2",
      title: "Define push notification payload",
      parentId: "task-5",
      priority: 3,
      projectId: work.id,
      sortOrder: 1,
    },
    {
      id: "task-5-sub-3",
      title: "Write email template specs",
      parentId: "task-5",
      priority: 3,
      projectId: work.id,
      sortOrder: 2,
    },
  ];

  for (const sub of subtasks) {
    await prisma.task.upsert({
      where: { id: sub.id },
      update: {},
      create: {
        ...sub,
        userId: user.id,
        completed: false,
      },
    });
  }
  console.log(`  ✅ Sub-tasks: ${subtasks.length} created`);

  // ---------------------------------------------------------------------------
  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📋 Demo credentials:");
  console.log("   Email:    demo@flowfocus.app");
  console.log("   Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
