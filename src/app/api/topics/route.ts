// src/app/api/topics/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import OpenAI from 'openai';
import { getInitialStanceSystemPrompt, getInitialStanceUserMessage } from '@/lib/prompts/initialStancePrompt';

const prisma = new PrismaClient();
const openai = new OpenAI();
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";

// --- POST function (Saves scaleDefinitions if valid) ---
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, category } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
        }
        const topicName = name.trim();
        const topicDescription = (typeof description === 'string' && description.trim().length > 0) ? description.trim() : null;

        // --- Call OpenAI ---
        let initialStance: number = 5.0;
        let stanceReasoning: string = "Default neutral stance assigned.";
        let scaleDefs: Prisma.JsonValue | null = null;

        try {
            console.log(`Calling OpenAI model ${openaiModel} for initial stance on topic: "${topicName}"`);
            const systemPrompt = getInitialStanceSystemPrompt();
            const userMessage = getInitialStanceUserMessage(topicName, topicDescription);

            const completion = await openai.chat.completions.create({
                model: openaiModel,
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content;
            console.log("Raw OpenAI Response:", content);

            let aiResult: { stance?: number; reasoning?: string; scaleDefinitions?: Record<string, string> } = {};
            if (content) {
                try { aiResult = JSON.parse(content); }
                catch (parseError) { console.error("Failed to parse OpenAI JSON response:", parseError); }
            } else { console.warn("OpenAI response content was null or empty."); }

            // Extract stance
            if (typeof aiResult.stance === 'number') {
                const potentialStance = parseFloat(aiResult.stance.toString());
                if (!isNaN(potentialStance)) { initialStance = Math.max(0, Math.min(10, potentialStance)); }
                else { console.warn(`OpenAI returned non-numeric stance: ${aiResult.stance}. Using default.`); }
            } else { console.warn("OpenAI response did not contain a numeric 'stance'. Using default."); }

            // Extract reasoning
            if (typeof aiResult.reasoning === 'string' && aiResult.reasoning.trim().length > 0) {
                stanceReasoning = aiResult.reasoning.trim();
            } else {
                console.warn("OpenAI response did not contain valid 'reasoning'. Using default.");
                stanceReasoning = `AI analysis resulted in stance ${initialStance.toFixed(1)}/10, but no specific reasoning was provided.`;
            }

            // Extract scaleDefinitions
            if (aiResult.scaleDefinitions && typeof aiResult.scaleDefinitions === 'object' && Object.keys(aiResult.scaleDefinitions).length > 0) {
                const keys = Object.keys(aiResult.scaleDefinitions);
                const looksValid = keys.length >= 10 && keys.every(k => !isNaN(parseInt(k)) && parseInt(k) >= 0 && parseInt(k) <= 10);
                if (looksValid) {
                    scaleDefs = aiResult.scaleDefinitions as Prisma.JsonValue;
                    console.log("Storing scale definitions received from OpenAI.");
                } else {
                    console.warn("Received 'scaleDefinitions' but structure seems invalid. Not storing.");
                    scaleDefs = null;
                }
            } else {
                console.log("OpenAI response did not include valid 'scaleDefinitions'. Not storing.");
                scaleDefs = null;
            }

        } catch (aiError: unknown) {
            console.error("Error calling OpenAI for initial stance:", aiError);
            const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI error';
            stanceReasoning = `AI analysis failed. Default neutral stance assigned. Error: ${errorMessage}`;
            scaleDefs = null;
        }
        // --- End OpenAI Call ---

        // Create topic in database - this requires prisma generate to have been run
        const newTopic = await prisma.topic.create({
            data: {
                name: topicName,
                description: topicDescription,
                category: category || null,
                currentStance: initialStance,
                stanceReasoning: stanceReasoning,
                scaleDefinitions: scaleDefs // Save the extracted definitions
            },
        });

        return NextResponse.json(newTopic, { status: 201 });

    } catch (error: unknown) {
        console.error('Topic creation error:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ error: 'A topic with this name already exists.' }, { status: 409 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// --- GET function (List topics) ---
export async function GET() {
    try {
        const topics = await prisma.topic.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(topics);
    } catch (error: unknown) {
        console.error('Error fetching topics:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}