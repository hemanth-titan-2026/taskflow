import { PrismaClient, Plan, OrgRole, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@taskflow.dev' },
    update: {},
    create: {
      email: 'admin@taskflow.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
    },
  });

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: 'taskflow-demo' },
    update: {},
    create: {
      name: 'TaskFlow Demo',
      slug: 'taskflow-demo',
      plan: Plan.PRO,
    },
  });

  // Add user as owner
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: OrgRole.OWNER,
    },
  });

  // Create demo project
  const project = await prisma.project.upsert({
    where: {
      organizationId_key: {
        organizationId: org.id,
        key: 'DEMO',
      },
    },
    update: {},
    create: {
      name: 'Demo Project',
      description: 'A sample project to demonstrate TaskFlow features',
      key: 'DEMO',
      organizationId: org.id,
    },
  });

  // Create sample tasks
  const tasks = [
    { title: 'Set up project repository', status: TaskStatus.DONE, priority: Priority.HIGH },
    { title: 'Design database schema', status: TaskStatus.DONE, priority: Priority.HIGH },
    { title: 'Implement authentication', status: TaskStatus.IN_PROGRESS, priority: Priority.URGENT },
    { title: 'Build REST API endpoints', status: TaskStatus.TODO, priority: Priority.HIGH },
    { title: 'Add WebSocket support', status: TaskStatus.BACKLOG, priority: Priority.MEDIUM },
    { title: 'Write integration tests', status: TaskStatus.BACKLOG, priority: Priority.LOW },
  ];

  for (let i = 0; i < tasks.length; i++) {
    await prisma.task.upsert({
      where: {
        projectId_number: {
          projectId: project.id,
          number: i + 1,
        },
      },
      update: {},
      create: {
        title: tasks[i].title,
        status: tasks[i].status,
        priority: tasks[i].priority,
        number: i + 1,
        position: i,
        projectId: project.id,
      },
    });
  }

  console.log('Seed completed successfully.');
  console.log(`  User: admin@taskflow.dev / password123`);
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Project: ${project.name} (${project.key})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
