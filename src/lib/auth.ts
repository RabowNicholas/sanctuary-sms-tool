import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          console.log('[Auth] Missing credentials');
          return null;
        }

        // Simple credential check - in production, verify against database
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        console.log('[Auth] Attempting login:', {
          providedUsername: credentials.username,
          expectedUsername: adminUsername,
          providedPassword: credentials.password,
          expectedPassword: adminPassword,
          hasHash: !!adminPasswordHash
        });

        if (credentials.username !== adminUsername) {
          return null;
        }

        // If no hash is set, use plain password comparison (development only)
        if (!adminPasswordHash) {
          if (credentials.password !== adminPassword) {
            console.log('[Auth] Password mismatch');
            return null;
          }
        } else {
          // Compare with hashed password
          const isValid = await bcrypt.compare(credentials.password, adminPasswordHash);
          if (!isValid) {
            return null;
          }
        }

        return {
          id: '1',
          name: adminUsername,
          email: `${adminUsername}@sanctuary.local`,
        };
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
