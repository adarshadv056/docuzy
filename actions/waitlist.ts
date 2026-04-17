"use server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function joinWaitlist(email: string) {
  try {
    await prisma.waitlist.create({
      data: {
        email: email,
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