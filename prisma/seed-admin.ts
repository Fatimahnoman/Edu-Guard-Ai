import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@eduguard.com';
  // Never hardcode credentials in source. Read from env with a secure generated
  // fallback (printed once to console so it can still be used locally).
  const password =
    process.env.ADMIN_SEED_PASSWORD ||
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error('ADMIN_SEED_PASSWORD must be set in production');
        })()
      : Array.from({ length: 16 }, () =>
          'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
            .charAt(Math.floor(Math.random() * 68))
        ).join(''));
  const name = 'EduGuard Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'admin', passwordHash, isActive: true },
    });
    console.log(`Updated existing user to admin: ${updated.email} (id: ${updated.id})`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'admin',
        emailVerified: new Date(),
        isActive: true,
        preferredLanguage: 'en',
      },
    });
    console.log(`Admin user created: ${user.email} (id: ${user.id})`);
  }

  console.log('\n--- Admin Login Credentials ---');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log('-------------------------------\n');

  await prisma.$disconnect();
}

createAdmin().catch((e) => {
  console.error('Failed to create admin user:', e);
  process.exit(1);
});
