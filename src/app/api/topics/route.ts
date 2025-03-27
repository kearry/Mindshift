import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Import options
import OpenAI from 'openai'; // Import OpenAI

const prisma = new PrismaClient();
const openai = new OpenAI(); // Initialize OpenAI client

// Read model name from environment variable, default to gpt-4o-mini
const openaiModel = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";

// --- POST function (Updated with Initial Stance AI Call) ---
export async function POST(request: Request) {
    // Check Authentication
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


        // --- Call OpenAI for Initial Stance ---
        let initialStance: number = 5.0; // Default stance
        let stanceReasoning: string = "Default neutral stance assigned."; // Default reasoning

        try {
            console.log(`Calling OpenAI model ${openaiModel} for initial stance on topic: "${topicName}"`);
            const completion = await openai.chat.completions.create({
                model: openaiModel,
                messages: [
                    {
                        role: "system",
                        content: `Analyze the following topic and determine your initial stance on it using a scale of 0 to 10, where 0 means completely supportive/in favor, 5 means neutral, and 10 means completely opposed/against. Provide detailed reasoning for your stance. Respond ONLY with a valid JSON object containing two keys: "stance" (a number between 0 and 10) and "reasoning" (a string explaining your position).`
                    },
                    {
                        role: "user",
                        content: `Topic: ${topicName}${topicDescription ? `\nDescription: ${topicDescription}` : ''}`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{}');

            if (typeof aiResult.stance === 'number') {
                const potentialStance = parseFloat(aiResult.stance);
                // Validate and clamp stance
                if (!isNaN(potentialStance)) {
                    initialStance = Math.max(0, Math.min(10, potentialStance));
                    console.log(`OpenAI returned initial stance: ${initialStance}`);
                } else {
                    console.warn(`OpenAI returned non-numeric stance: ${aiResult.stance}. Using default.`);
                }
            } else {
                console.warn("OpenAI response did not contain a numeric 'stance'. Using default.");
            }

            if (typeof aiResult.reasoning === 'string' && aiResult.reasoning.trim().length > 0) {
                stanceReasoning = aiResult.reasoning.trim();
            } else {
                console.warn("OpenAI response did not contain valid 'reasoning'. Using default.");
                stanceReasoning = `AI analysis resulted in stance ${initialStance.toFixed(1)}/10, but no specific reasoning was provided.`;
            }

        } catch (aiError) {
            console.error("Error calling OpenAI for initial stance:", aiError);
            // Proceed with default stance if AI call fails
            stanceReasoning = `AI analysis failed. Default neutral stance assigned. Error: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`;
        }
        // --- End OpenAI Call ---


        // Create topic in database using the determined stance
        const newTopic = await prisma.topic.create({
            data: {
                name: topicName,
                description: topicDescription,
                category: category || null,
                currentStance: initialStance, // Use stance from AI (or default)
                stanceReasoning: stanceReasoning, // Use reasoning from AI (or default/error)
            },
        });

        return NextResponse.json(newTopic, { status: 201 });

    } catch (error) {
        console.error('Topic creation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        // await prisma.$disconnect(); // Manage client lifecycle
    }
}

// --- GET function (remains the same) ---
export async function GET() {
    try {
        const topics = await prisma.topic.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, });
        return NextResponse.json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}