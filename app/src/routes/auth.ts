import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db";
import { COOKIE_NAME, config } from "../config";
import { signAuthToken } from "../auth/jwt";

export const authRouter = Router();

authRouter.get("/login", (req, res) => {
  if (req.cookies?.[COOKIE_NAME]) {
    res.redirect("/admin");
    return;
  }
  res.render("login", { error: null });
});

authRouter.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      res.status(400).json({ error: "email_and_password_required" });
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const token = signAuthToken({ sub: admin.id, email: admin.email });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({ ok: true, email: admin.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true });
});
