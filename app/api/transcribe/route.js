import { NextResponse } from "next/server";
import { auth } from "@/auth";
export const POST = auth(async (request) => {
    if (!request.auth?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }
        const buffer = await file.arrayBuffer();
        const audioBlob = new Blob([buffer], { type: file.type });
        const upstreamBody = new FormData();
        upstreamBody.append("file", audioBlob, "audio.webm");
        upstreamBody.append("model", "whisper-1");
        const openAiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: upstreamBody
        });
        const data = await openAiResponse.json();
        if (!openAiResponse.ok) {
            return NextResponse.json({ error: data.error?.message ?? "Transcription failed" }, { status: openAiResponse.status });
        }
        return NextResponse.json({ text: data.text });
    }
    catch (error) {
        console.error("Error during transcription:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
});
