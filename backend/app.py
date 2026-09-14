import random
import uuid
from typing import Literal, Optional

import ollama
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

MODEL = "llama3"
QUESTIONS_PER_SESSION = 5

QUESTION_BANK = {
    "behavioral": [
        "Tell me about a time you faced a conflict with a coworker. How did you handle it?",
        "Describe a project you're proud of. What was your role?",
        "Tell me about a time you failed. What did you learn?",
        "How do you handle tight deadlines or pressure?",
        "Describe a time you had to learn something new quickly.",
        "Tell me about a time you disagreed with a decision at work.",
        "How do you prioritize when you have multiple competing tasks?",
    ],
    "technical": [
        "Walk me through how you would approach debugging a slow API endpoint.",
        "Explain the difference between a process and a thread.",
        "How would you design a URL shortener at a high level?",
        "What's a technical decision you made that you'd reconsider today?",
        "How do you approach writing tests for a new feature?",
        "How would you explain caching to a non-technical teammate?",
        "What would you check first if a production service started erroring?",
    ],
}

TONE_BY_DIFFICULTY = {
    "gentle": "warm, reassuring, and highly encouraging. Go easy on criticism.",
    "moderate": "supportive but honest, giving balanced praise and constructive suggestions.",
    "challenging": "direct and rigorous like a real interviewer, while remaining respectful.",
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, dict] = {}


class StartRequest(BaseModel):
    track: Literal["behavioral", "technical"]
    mode: Literal["quick", "full"]
    difficulty: Literal["gentle", "moderate", "challenging"] = "moderate"
    role: Optional[str] = None


class AnswerRequest(BaseModel):
    session_id: str
    action: Literal["answer", "skip", "next"] = "answer"
    answer: Optional[str] = None


class EndRequest(BaseModel):
    session_id: str


def get_session(session_id: str) -> dict:
    session = sessions.get(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    return session


def current_question_meta(session: dict) -> dict:
    index = session["index"]
    total = len(session["questions"])
    if index >= total:
        return {"done": True}
    return {"done": False, "question": session["questions"][index], "index": index, "total": total}


def feedback_system_prompt(session: dict) -> str:
    tone = TONE_BY_DIFFICULTY[session["difficulty"]]
    role = session["role"] or "the role they're applying for"
    return (
        f"You are a supportive {session['track']} interview coach helping a candidate "
        f"practice for {role}. Be {tone} "
        "After the candidate's answer, give brief feedback in 2-4 sentences: one thing "
        "they did well, then one concrete suggestion to improve. Do not ask a new question."
    )


def summary_system_prompt(session: dict) -> str:
    tone = TONE_BY_DIFFICULTY[session["difficulty"]]
    return (
        f"You are a supportive {session['track']} interview coach. Be {tone} "
        "You will receive a full mock interview transcript (questions and answers, some "
        "may have been skipped). Write an encouraging session summary: start with what "
        "the candidate did well, then name at most two focus areas for next time. Do not "
        "list every mistake."
    )


@app.post("/session/start")
def start_session(req: StartRequest):
    bank = QUESTION_BANK[req.track]
    questions = random.sample(bank, min(QUESTIONS_PER_SESSION, len(bank)))
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "track": req.track,
        "mode": req.mode,
        "difficulty": req.difficulty,
        "role": req.role,
        "questions": questions,
        "index": 0,
        "answers": [None] * len(questions),
    }
    return {"session_id": session_id, **current_question_meta(sessions[session_id])}


def stream_feedback(session: dict, index: int, question: str, answer: str):
    messages = [
        {"role": "system", "content": feedback_system_prompt(session)},
        {"role": "user", "content": f"Question: {question}\nCandidate's answer: {answer}"},
    ]
    feedback = ""
    for chunk in ollama.chat(model=MODEL, messages=messages, stream=True):
        piece = chunk["message"]["content"]
        feedback += piece
        yield piece

    session["answers"][index] = {
        "question": question, "answer": answer, "feedback": feedback, "skipped": False
    }


@app.post("/session/answer")
def answer(req: AnswerRequest):
    session = get_session(req.session_id)
    meta = current_question_meta(session)
    if meta["done"]:
        return JSONResponse(meta)

    index = session["index"]
    question = session["questions"][index]

    if req.action == "next":
        session["index"] += 1
        return JSONResponse(current_question_meta(session))

    if req.action == "skip":
        session["answers"][index] = {
            "question": question, "answer": None, "feedback": None, "skipped": True
        }
        session["index"] += 1
        return JSONResponse(current_question_meta(session))

    if not req.answer:
        raise HTTPException(400, "answer is required")

    if session["mode"] == "quick":
        return StreamingResponse(
            stream_feedback(session, index, question, req.answer), media_type="text/plain"
        )

    session["answers"][index] = {
        "question": question, "answer": req.answer, "feedback": None, "skipped": False
    }
    return JSONResponse({"stored": True})


def stream_summary(session: dict):
    transcript_lines = []
    for i, entry in enumerate(session["answers"], start=1):
        if entry is None:
            continue
        if entry["skipped"]:
            transcript_lines.append(f"Q{i}: {entry['question']}\nA{i}: (skipped)")
        else:
            transcript_lines.append(f"Q{i}: {entry['question']}\nA{i}: {entry['answer']}")
    transcript = "\n\n".join(transcript_lines)

    messages = [
        {"role": "system", "content": summary_system_prompt(session)},
        {"role": "user", "content": transcript},
    ]
    for chunk in ollama.chat(model=MODEL, messages=messages, stream=True):
        yield chunk["message"]["content"]


@app.post("/session/end")
def end_session(req: EndRequest):
    session = get_session(req.session_id)

    if session["mode"] == "full":
        response = StreamingResponse(stream_summary(session), media_type="text/plain")
        del sessions[req.session_id]
        return response

    lines = []
    for i, entry in enumerate(session["answers"], start=1):
        if entry is None:
            continue
        if entry["skipped"]:
            lines.append(f"Q{i}: {entry['question']}\n(skipped)")
        else:
            lines.append(f"Q{i}: {entry['question']}\n{entry['feedback']}")
    summary = "\n\n".join(lines) if lines else "No questions were answered."
    del sessions[req.session_id]
    return JSONResponse({"summary": summary})
