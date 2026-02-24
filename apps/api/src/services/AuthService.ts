import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { User, LicenseTier, Role } from '@prisma/client';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'nodeweaver-secret-key-change-in-prod';

export class AuthService {
  
  public async register(username: string, password: string, licenseKey?: string) {
    // 1. Check if user exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        throw new Error('Username already exists');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 2.1 Generate human-friendly account code
    const accountCode = await this.generateUniqueAccountCode();

    // 3. Create User
    // Default to USER role. First user defined? Maybe make admin manually later.
    const user = await prisma.user.create({
        data: {
            username,
            accountCode,
            passwordHash,
            role: Role.USER
        }
    });

    try {
        // 4. Activate License if provided
        if (licenseKey) {
            await this.activateLicense(user.id, licenseKey);
        } else {
            // Create a default FREE license (Observer)
            await this.createFreeLicense(user.id);
        }

        // 5. Generate Token (reload user to get license info)
        const userWithLicense = await prisma.user.findUnique({
            where: { id: user.id },
            include: { license: true }
        });
        return this.generateToken(userWithLicense!);
    } catch (error) {
        // Rollback: Delete user if license processing fails
        await prisma.user.delete({ where: { id: user.id } });
        throw error;
    }
  }

  public async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ 
        where: { username },
        include: { license: true }
    });
    
    if (!user) {
        throw new Error('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user);
    
    return {
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            licenseTier: user.license?.tier || LicenseTier.OBSERVER
        },
        token
    };
  }

    private generateToken(user: User & { license?: { tier: LicenseTier } | null }) {
    return jwt.sign(
        { 
            userId: user.id, 
            username: user.username,
            role: user.role,
                        licenseTier: user.license?.tier || LicenseTier.OBSERVER,
                        accountCode: (user as any).accountCode
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
  }

  public async activateLicense(userId: string, key: string) {
    if (!key) throw new Error('License key is required');
    
    const license = await prisma.license.findUnique({ where: { key } });
    
    if (!license) throw new Error('Invalid license key');
    if (license.userId && license.userId !== userId) throw new Error('License already used');
    
    // Link license to user
    await prisma.license.update({
        where: { key },
        data: { userId }
    });
    
    return license;
  }
  
  private async createFreeLicense(userId: string) {
      await prisma.license.create({
          data: {
              key: `FREE-${userId.substring(0,8).toUpperCase()}`,
              tier: LicenseTier.OBSERVER,
              userId: userId
          }
      });
  }
  
  // CEO Functionality: Generate License
  public async generateLicense(tier: LicenseTier, _creatorId: string, durationDays?: number) {
      const key = `NW-${tier}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
      
      let expiresAt: Date | null = null;
      if (durationDays) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);
      }

      const license = await prisma.license.create({
          data: {
              key,
              tier,
              isActive: true,
              expiresAt
          }
      });
      return license;
  }

    private async generateUniqueAccountCode(): Promise<string> {
        const makeCode = () => {
            const rand = randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
            return `NW-${rand}`;
        };

        // Try until unique
        for (let i = 0; i < 10; i++) {
            const code = makeCode();
            const existing = await prisma.user.findUnique({ where: { accountCode: code } });
            if (!existing) return code;
        }

        // Fallback with extra entropy
        return `NW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    }
}

export const authService = new AuthService();
