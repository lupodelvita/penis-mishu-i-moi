# 🧠 NodeWeaver AI Assistant: Setup & Training Guide

## 1. Connection (How it works)

NodeWeaver uses a local AI stack to ensure privacy and zero cost.

- **Engine**: [Ollama](https://ollama.com) (Running locally via Docker).
- **Interface**: Open WebUI (Running at `http://localhost:8181`).
- **Brain**: NodeWeaver API (`AIMemory` Service).

### Status Check

Ensure your Docker containers are running:

```bash
docker ps
```

You should see: `nodeweaver-ollama`, `nodeweaver-webui`, `nodeweaver-postgres`.

## 2. Connecting to Open WebUI

1.  Open your browser to: [http://localhost:8181](http://localhost:8181)
2.  **First Login**: Sign up for an account (this is locally stored on your machine).
3.  **Model Selection**:
    - Go to **Settings > Models**.
    - Pull a model like `llama3` or `mistral`.
    - _Note: This might take a while depending on your internet._

## 3. Training the AI (The Feedback Loop)

The AI "learns" from your investigations through the Feedback system.

### How to Train:

1.  **Ask a Question**: Use the "AI Assistant" panel in the Graph view.
    - _Example: "What is the relationship between IP 1.1.1.1 and Domain example.com?"_
2.  **Rate the Answer**:
    - 👍 **Good**: The answer is saved to `AIMemory`. Future queries will search these "Good" examples to provide context.
    - 👎 **Bad**: The answer is discarded/flagged.
3.  **Explicit Training (Operator/Developer Tier)**:
    - You can manually insert training data via the API (coming soon to UI).

### "Memory" Concept

The system uses RAG (Retrieval-Augmented Generation).

- When you ask a question, the system looks up similar **past successful answers**.
- It injects these into the prompt: _"Here is how you answered a similar question in the past..."_
- **Result**: The more you use it (and rate it), the smarter it gets specifically for _your_ investigation style.

## 4. Troubleshooting

- **"AI is unresponsive"**: Check `docker logs nodeweaver-ollama`.
- **"WebUI not loading"**: Ensure port `8181` is not blocked.
