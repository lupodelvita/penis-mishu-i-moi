import { prisma } from '../lib/prisma';

export class UserService {
  public async getWithLicense(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { 
        license: true,
        bots: true 
      }
    });
  }

  public async getById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId }
    });
  }
}

export const userService = new UserService();
