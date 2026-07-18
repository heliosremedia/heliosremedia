import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const faqSelect = {
  id: true,
  categoryId: true,
  question: true,
  answer: true,
  displayOrder: true,
  published: true,
  createdAt: true,
  updatedAt: true,
} as const;

function refreshFaqs() {
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
}

function validateContent(question: unknown, answer: unknown) {
  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  const cleanAnswer = typeof answer === "string" ? answer.trim() : "";
  if (!cleanQuestion || cleanQuestion.length > 240) throw new Error("QUESTION");
  if (!cleanAnswer || cleanAnswer.length > 5000) throw new Error("ANSWER");
  return { question: cleanQuestion, answer: cleanAnswer };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const { question, answer } = validateContent(body.question, body.answer);
    const category = await prisma.faqCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ success: false, error: "Select a valid FAQ category." }, { status: 400 });

    const order = await prisma.faq.aggregate({ where: { categoryId }, _max: { displayOrder: true } });
    const faq = await prisma.faq.create({
      data: { categoryId, question, answer, displayOrder: (order._max.displayOrder ?? -1) + 1, published: body.published === true },
      select: faqSelect,
    });
    refreshFaqs();
    return NextResponse.json({ success: true, faq }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION") return NextResponse.json({ success: false, error: "A question between 1 and 240 characters is required." }, { status: 400 });
    if (error instanceof Error && error.message === "ANSWER") return NextResponse.json({ success: false, error: "An answer between 1 and 5,000 characters is required." }, { status: 400 });
    console.error("Unable to create FAQ:", error);
    return NextResponse.json({ success: false, error: "The FAQ could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "reorder") {
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
      const ids = Array.isArray(body.faqIds) ? body.faqIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.faq.findMany({ where: { categoryId }, select: { id: true } });
      if (!categoryId || ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) {
        return NextResponse.json({ success: false, error: "This FAQ category changed before the order was saved. Refresh and try again." }, { status: 409 });
      }
      await prisma.$transaction(ids.map((id, index) => prisma.faq.update({ where: { id }, data: { displayOrder: index } })));
      refreshFaqs();
      return NextResponse.json({ success: true, faqIds: ids });
    }

    const faqId = typeof body.faqId === "string" ? body.faqId : "";
    if (!faqId) return NextResponse.json({ success: false, error: "An FAQ ID is required." }, { status: 400 });

    if (action === "set-published") {
      if (typeof body.published !== "boolean") return NextResponse.json({ success: false, error: "A valid publishing status is required." }, { status: 400 });
      const faq = await prisma.faq.update({ where: { id: faqId }, data: { published: body.published }, select: faqSelect });
      refreshFaqs();
      return NextResponse.json({ success: true, faq });
    }

    if (action === "update") {
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
      const category = await prisma.faqCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!category) return NextResponse.json({ success: false, error: "Select a valid FAQ category." }, { status: 400 });
      const { question, answer } = validateContent(body.question, body.answer);
      const existing = await prisma.faq.findUnique({ where: { id: faqId }, select: { categoryId: true } });
      if (!existing) return NextResponse.json({ success: false, error: "The FAQ was not found." }, { status: 404 });

      let displayOrder: number | undefined;
      if (existing.categoryId !== categoryId) {
        const order = await prisma.faq.aggregate({ where: { categoryId }, _max: { displayOrder: true } });
        displayOrder = (order._max.displayOrder ?? -1) + 1;
      }
      const faq = await prisma.faq.update({ where: { id: faqId }, data: { categoryId, question, answer, ...(displayOrder === undefined ? {} : { displayOrder }) }, select: faqSelect });
      refreshFaqs();
      return NextResponse.json({ success: true, faq });
    }

    return NextResponse.json({ success: false, error: "Unsupported FAQ action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTION") return NextResponse.json({ success: false, error: "A question between 1 and 240 characters is required." }, { status: 400 });
    if (error instanceof Error && error.message === "ANSWER") return NextResponse.json({ success: false, error: "An answer between 1 and 5,000 characters is required." }, { status: 400 });
    console.error("Unable to update FAQ:", error);
    return NextResponse.json({ success: false, error: "The FAQ could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const faqId = new URL(request.url).searchParams.get("faqId")?.trim();
    if (!faqId) return NextResponse.json({ success: false, error: "An FAQ ID is required." }, { status: 400 });
    await prisma.faq.delete({ where: { id: faqId } });
    refreshFaqs();
    return NextResponse.json({ success: true, deletedFaqId: faqId });
  } catch (error) {
    console.error("Unable to delete FAQ:", error);
    return NextResponse.json({ success: false, error: "The FAQ could not be deleted." }, { status: 500 });
  }
}
