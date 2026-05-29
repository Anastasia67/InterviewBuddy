from fastapi import FastAPI
from pydantic import BaseModel
import ollama

app = FastAPI()

class Prompt(BaseModel):
    message: str

@app.post("/chat")
def chat(prompt: Prompt):

    response = ollama.chat(
        model='qwen2.5-coder',
        messages=[
            {
                'role': 'user',
                'content': prompt.message
            }
        ]
    )

    return {
        "response": response['message']['content']
    }