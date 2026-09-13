import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth.js v5 configuration (session strategy "jwt").
 *
 * The credentials provider reuses the password hasher from @logiflow/db.
 * We use require() to avoid Turbopack bundling the native module at load time.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        // require() at runtime so Turbopack doesn't bundle the native dep
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("@logiflow/db");
        const drizzleOrm = require("drizzle-orm");

        const db = mod.getDb();

        const user = db
          .select()
          .from(mod.users)
          .where(drizzleOrm.eq(mod.users.email, email))
          .get();

        if (!user) return null;
        if (!user.active) return null;

        const result = mod.verifyPassword(password, user.passwordHash);
        if (!result.valid) return null;

        const tenant = db
          .select()
          .from(mod.tenants)
          .where(drizzleOrm.eq(mod.tenants.id, user.tenantId))
          .get();

        if (!tenant) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: null,
          tenantId: user.tenantId,
          role: user.role,
        } as unknown as { id: string; email: string; name: string; image: string | null; tenantId: string; role: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; tenantId: string; role: string };
        token.userId = u.id;
        token.tenantId = u.tenantId;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
