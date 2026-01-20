import { SignupKeywordRepository } from '@/domain/repositories/SignupKeywordRepository';
import { SignupKeyword } from '@/domain/entities/SignupKeyword';
import { PrismaClient } from '@/generated/prisma';

export class PrismaSignupKeywordRepository implements SignupKeywordRepository {
  constructor(private prisma: PrismaClient) {}

  async add(keyword: SignupKeyword): Promise<SignupKeyword> {
    const created = await this.prisma.signupKeyword.create({
      data: {
        id: keyword.id,
        keyword: keyword.keyword,
        autoResponse: keyword.autoResponse,
        isActive: keyword.isActive,
        listId: keyword.listId,
      },
    });

    return SignupKeyword.fromPersistence(
      created.id,
      created.keyword,
      created.autoResponse,
      created.isActive,
      created.listId,
      created.createdAt
    );
  }

  async findByKeyword(keyword: string): Promise<SignupKeyword | null> {
    const found = await this.prisma.signupKeyword.findUnique({
      where: { keyword: keyword.toUpperCase() },
    });

    if (!found) {
      return null;
    }

    return SignupKeyword.fromPersistence(
      found.id,
      found.keyword,
      found.autoResponse,
      found.isActive,
      found.listId,
      found.createdAt
    );
  }

  async findById(id: string): Promise<SignupKeyword | null> {
    const found = await this.prisma.signupKeyword.findUnique({
      where: { id },
    });

    if (!found) {
      return null;
    }

    return SignupKeyword.fromPersistence(
      found.id,
      found.keyword,
      found.autoResponse,
      found.isActive,
      found.listId,
      found.createdAt
    );
  }

  async findAllActive(): Promise<SignupKeyword[]> {
    const keywords = await this.prisma.signupKeyword.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return keywords.map(k =>
      SignupKeyword.fromPersistence(
        k.id,
        k.keyword,
        k.autoResponse,
        k.isActive,
        k.listId,
        k.createdAt
      )
    );
  }

  async findAll(): Promise<SignupKeyword[]> {
    const keywords = await this.prisma.signupKeyword.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return keywords.map(k =>
      SignupKeyword.fromPersistence(
        k.id,
        k.keyword,
        k.autoResponse,
        k.isActive,
        k.listId,
        k.createdAt
      )
    );
  }

  async update(keyword: SignupKeyword): Promise<SignupKeyword> {
    const updated = await this.prisma.signupKeyword.update({
      where: { id: keyword.id },
      data: {
        keyword: keyword.keyword,
        autoResponse: keyword.autoResponse,
        isActive: keyword.isActive,
        listId: keyword.listId,
      },
    });

    return SignupKeyword.fromPersistence(
      updated.id,
      updated.keyword,
      updated.autoResponse,
      updated.isActive,
      updated.listId,
      updated.createdAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.signupKeyword.delete({
      where: { id },
    });
  }
}
