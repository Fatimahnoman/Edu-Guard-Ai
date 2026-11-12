import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe.skipIf(!process.env.DATABASE_URL)('Seed Data Integrity', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('verifies countries exist (8+)', async () => {
    const count = await prisma.country.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it('verifies universities exist (12+)', async () => {
    const count = await prisma.university.count();
    expect(count).toBeGreaterThanOrEqual(12);
  });

  it('verifies courses exist (20+)', async () => {
    const count = await prisma.course.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  it('verifies scholarships exist (10+)', async () => {
    const count = await prisma.scholarship.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it('verifies career paths exist (15+)', async () => {
    const count = await prisma.careerPath.count();
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it('verifies university rankings exist (4+)', async () => {
    const count = await prisma.universityRanking.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('verifies visa information exists (3)', async () => {
    const count = await prisma.visaInformation.count();
    expect(count).toBe(3);
  });

  it('verifies admission requirements exist (8+)', async () => {
    const count = await prisma.admissionRequirement.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it('verifies scholarship requirements exist (28+)', async () => {
    const count = await prisma.scholarshipRequirement.count();
    expect(count).toBeGreaterThanOrEqual(28);
  });
});
