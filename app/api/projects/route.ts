import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/utils/auth"

export async function GET() {
  try {

    console.log('GET request received for projects');
    const userId = await getAuthenticatedUserId();

    console.log('userId', userId);
    
    const projects = await prisma.project.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("[PROJECTS_GET]", error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const body = await req.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId,
      }
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("[PROJECTS_POST]", error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
} 
