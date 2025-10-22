## AI Storyboard Generator

Turn a simple idea into a compact storyboard: 6–10 beats with titles, brief descriptions, and image prompts. Includes a Gemini/ChatGPT‑style web UI and a CLI. Uses a pluggable LLM provider with a zero‑cost Mock provider by default; OpenAI is optional.

### Features
- **Chat-style web UI**: Gemini/ChatGPT look and feel with chat bubbles, sticky composer, theme toggle, and suggestion chips
- **Export tools**: Copy or download storyboard as JSON from the UI
- **CLI tool**: Generate and print/save a storyboard from the terminal
- **Pluggable providers**: Mock (default) and OpenAI provider
- **Simple JSON schema**: `idea`, `beats` (title, description, image_prompt), `notes`

### Project structure
- `app.py`: Flask web app with chat UI
- `cli.py`: Command-line entry to generate a storyboard
- `ai_storyboard/`
  - `models.py`: `StoryBeat`, `Storyboard`
  - `service.py`: `StoryboardService` (LLM prompt + JSON parsing)
  - `providers/base.py`: `LLMProvider` interface
  - `providers/mock.py`: Mock provider (deterministic example output)
  - `providers/openai_provider.py`: OpenAI provider (optional)
- `requirements.txt`: Dependencies

### Prerequisites
- Python 3.10+ recommended
- For the web app: Flask (installed via `requirements.txt`)
- For OpenAI provider (optional): OpenAI API key

### Setup
You can use your system Python, or a virtual environment.

- System Python (quick start):
```bash
python3 -m pip install -r requirements.txt
```

- Virtual environment (if available on your system):
```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```
If `venv` is missing on Debian/Ubuntu, install it: `sudo apt-get install -y python3-venv`.

### Run the web app (Gemini/ChatGPT-like UI)
```bash
python3 app.py
```
Then open `http://localhost:7860` in your browser.

- Type your idea in the composer (press Enter to send)
- Toggle theme with the header button
- Use suggestion chips to try example prompts
- Copy or Download the generated storyboard JSON

### Use the CLI
```bash
python3 cli.py "A cozy sci‑fi about a robot barista learning to make friends"
```
Save to a file:
```bash
python3 cli.py "Time‑loop heist to steal a sunrise" -o out.json
```

### Example output (Mock provider)
```json
{
  "idea": "A cozy sci-fi about a robot barista learning to make friends",
  "beats": [
    {
      "title": "Hook",
      "description": "Introduce the main character and world.",
      "image_prompt": "wide shot, cinematic"
    },
    { "title": "Inciting Incident", "description": "A problem disrupts normal life.", "image_prompt": "dramatic lighting" },
    { "title": "Decision", "description": "The hero commits to a goal.", "image_prompt": "close-up determination" },
    { "title": "Midpoint", "description": "A twist changes the stakes.", "image_prompt": "dynamic composition" },
    { "title": "All Is Lost", "description": "The worst setback happens.", "image_prompt": "low-key lighting" },
    { "title": "Climax", "description": "Final confrontation resolves the conflict.", "image_prompt": "high contrast" }
  ],
  "notes": "Example output from MockProvider"
}
```

### OpenAI provider (optional)
1) Set your environment variables:
```bash
export OPENAI_API_KEY=sk-...   # required
export OPENAI_MODEL=gpt-4o-mini # optional (defaults to gpt-4o-mini)
```
2) Switch the provider in code (web or CLI). Replace the Mock provider with OpenAI:
```python
from ai_storyboard.providers.openai_provider import OpenAIProvider
service = StoryboardService(provider=OpenAIProvider())
```
- In `app.py`, update the two lines near the top that import and instantiate the provider
- In `cli.py`, update the import and the `StoryboardService` instantiation similarly

### JSON schema
- **idea**: string
- **beats**: array of objects
  - **title**: string
  - **description**: string
  - **image_prompt**: string
- **notes**: string (optional)

### Troubleshooting
- If `venv` creation fails with `ensurepip is not available`, install `python3-venv` or use system Python
- If the web port `7860` is taken, edit the `port` in `app.py`
- If OpenAI calls fail, confirm `OPENAI_API_KEY` is set and the model name is correct

### License
Unlicensed – internal prototype. Update as needed for your use.
