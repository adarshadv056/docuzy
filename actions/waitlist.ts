"use server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function joinWaitlist(email: string, honeypot?: string) {
  try {
    if (honeypot) {
      return { success: false, message: "Spam detected" };
    }

    const cleanEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, message: "Invalid email format" };
    }

    if (cleanEmail.length > 254) {
      return { success: false, message: "Email too long" };
    }

    const blockedDomains = ["tempmail.com", "10minutemail.com"];
    const domain = cleanEmail.split("@")[1];

    if (blockedDomains.some(d => domain.includes(d))) {
      return { success: false, message: "Please use a valid email" };
    }

    await prisma.waitlist.create({
      data: {
        email: cleanEmail,
      },
    });

    revalidatePath("/");
    return { success: true, message: "Added to waitlist" };

  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, message: "You are already on the waitlist!" };
    }

    return { success: false, message: "Something went wrong. Please try again." };
  }
}

export async function getWaitlistCount() {
  try {
    const count = await prisma.waitlist.count();
    return count;
  } catch (error) {
    return 0;
  }
}