from flask import Flask, render_template_string, request
from ai_storyboard.providers.mock import MockProvider
from ai_storyboard.service import StoryboardService

app = Flask(__name__)
service = StoryboardService(provider=MockProvider())

TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Storyboard</title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #0b1020;
      --muted: #667085;
      --card: #f6f7f9;
      --border: #e5e7eb;
      --accent: #111827;
      --chip: #f1f5f9;
      --shadow: 0 10px 20px rgba(2,6,23,0.06);
    }
    .dark {
      --bg: #0b1020;
      --fg: #eaf1ff;
      --muted: #93a4c6;
      --card: #0f1629;
      --border: #1f2a44;
      --accent: #22d3ee;
      --chip: #0b1224;
      --shadow: 0 10px 24px rgba(2,6,23,0.4);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      background: var(--bg);
      color: var(--fg);
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(0,0,0,0.03), transparent);
      backdrop-filter: saturate(140%) blur(6px);
    }
    .topbar-inner {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
    }
    .brand {
      display: flex; align-items: center; gap: 10px;
      font-weight: 700; letter-spacing: 0.2px;
    }
    .brand .logo {
      width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--accent), #8b5cf6);
      box-shadow: var(--shadow);
    }
    .icon-btn {
      appearance: none; border: 1px solid var(--border); background: var(--chip);
      color: var(--fg); padding: 8px 10px; border-radius: 10px; cursor: pointer;
    }
    .shell { max-width: 900px; margin: 0 auto; padding: 16px; padding-bottom: 120px; }

    .suggestions { margin: 36px auto; max-width: 680px; text-align: center; color: var(--muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 10px; }
    .chip { border: 1px solid var(--border); background: var(--chip); color: var(--fg); padding: 8px 12px; border-radius: 999px; cursor: pointer; }

    .chat { display: flex; flex-direction: column; gap: 14px; min-height: calc(100vh - 220px); }
    .msg { display: flex; width: 100%; }
    .msg.user { justify-content: flex-end; }
    .msg.assistant { justify-content: flex-start; }
    .bubble {
      max-width: min(720px, 86%);
      border: 1px solid var(--border);
      background: var(--card);
      border-radius: 16px;
      padding: 12px 14px;
      box-shadow: var(--shadow);
    }
    .user .bubble {
      background: linear-gradient(180deg, rgba(34,211,238,0.18), rgba(34,211,238,0.06));
      border-color: rgba(34,211,238,0.35);
    }
    .role { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .beats { margin: 8px 0 0 0; padding: 0 0 0 18px; display: grid; gap: 10px; }
    .beats li { background: rgba(255,255,255,0.55); border: 1px solid var(--border); border-radius: 12px; padding: 10px; list-style: decimal; }
    .dark .beats li { background: rgba(5,8,20,0.55); }
    .t { font-weight: 600; }
    .d { margin-top: 4px; }
    .p { margin-top: 4px; font-size: 12px; color: var(--muted); }
    .p code { background: rgba(2,6,23,0.06); padding: 2px 6px; border-radius: 6px; }
    .notes { margin-top: 12px; }
    .notes pre { margin: 6px 0 0 0; background: #0b1224; color: #e5e7eb; padding: 10px; border-radius: 10px; overflow: auto; }

    .tools { display: flex; gap: 8px; margin-top: 10px; }
    .btn { background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; }

    .composer {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: linear-gradient(180deg, transparent, var(--bg) 20%);
      padding: 16px;
    }
    .composer-inner { max-width: 900px; margin: 0 auto; display: flex; gap: 10px; align-items: flex-end; }
    textarea#idea {
      flex: 1; resize: none; max-height: 200px; min-height: 44px; padding: 12px 14px; border-radius: 14px;
      border: 1px solid var(--border); background: var(--bg); color: var(--fg);
      outline: none;
    }
    button#sendBtn { padding: 12px 16px; border-radius: 12px; background: var(--accent); color: white; border: none; cursor: pointer; }
  </style>
  <script>
    (function(){
      try { if (localStorage.getItem('theme') === 'dark') { document.documentElement.classList.add('dark'); } } catch(e) {}
    })();
  </script>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><div class="logo"></div> AI Storyboard</div>
      <div class="actions">
        <button class="icon-btn" id="themeToggle" title="Toggle theme">Theme</button>
      </div>
    </div>
  </header>

  <main class="shell">
    <section class="chat" id="chat">
      {% if idea %}
      <div class="msg user">
        <div class="bubble">
          <div class="role">You</div>
          <div class="content">{{ idea }}</div>
        </div>
      </div>
      {% endif %}

      {% if board %}
      <div class="msg assistant">
        <div class="bubble">
          <div class="role">Storyboard</div>
          <ol class="beats">
          {% for b in board.beats %}
            <li>
              <div class="t">{{ b.title }}</div>
              <div class="d">{{ b.description }}</div>
              <div class="p">Image prompt: <code>{{ b.image_prompt }}</code></div>
            </li>
          {% endfor %}
          </ol>
          {% if board.notes %}
            <div class="notes"><strong>Notes</strong>
              <pre>{{ board.notes }}</pre>
            </div>
          {% endif %}
          <div class="tools">
            <button class="btn" id="btnCopy">Copy JSON</button>
            <button class="btn" id="btnDownload">Download JSON</button>
          </div>
        </div>
      </div>
      {% else %}
      <div class="suggestions">
        <div>Try one:</div>
        <div class="chips">
          {% for s in suggestions %}
            <button type="button" class="chip" data-text="{{ s }}">{{ s }}</button>
          {% endfor %}
        </div>
      </div>
      {% endif %}
    </section>
  </main>

  <form class="composer" method="post" id="composer">
    <div class="composer-inner">
      <textarea name="idea" id="idea" rows="1" placeholder="Describe your story idea..." required>{{ idea or '' }}</textarea>
      <button type="submit" id="sendBtn">Generate</button>
    </div>
  </form>

  <script>
    (function(){
      const html = document.documentElement;
      const toggle = document.getElementById('themeToggle');
      toggle?.addEventListener('click', () => {
        html.classList.toggle('dark');
        try { localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light'); } catch(e) {}
      });

      const chips = document.querySelectorAll('.chip');
      const ideaInput = document.getElementById('idea');
      const composer = document.getElementById('composer');
      chips.forEach(ch => ch.addEventListener('click', () => {
        ideaInput.value = ch.dataset.text || '';
        composer.submit();
      }));

      const chat = document.getElementById('chat');
      if (chat) { chat.scrollTop = chat.scrollHeight; }

      {% if board_data %}
      const data = {{ board_data|tojson }};
      document.getElementById('btnCopy')?.addEventListener('click', async () => {
        const text = JSON.stringify(data, null, 2);
        try { await navigator.clipboard.writeText(text); } catch(e) {}
      });
      document.getElementById('btnDownload')?.addEventListener('click', () => {
        const text = JSON.stringify(data, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'storyboard.json'; a.click();
        URL.revokeObjectURL(url);
      });
      {% endif %}

      // autosize and Enter-to-send
      const ta = ideaInput;
      const resize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; };
      ta.addEventListener('input', resize);
      resize();
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); }
      });
    })();
  </script>
</body>
</html>
"""


@app.route('/', methods=['GET', 'POST'])
def index():
  idea = ''
  board = None
  board_data = None
  suggestions = [
    "Wholesome cyberpunk tea shop that heals memories",
    "Fantasy cooking contest judged by dragons",
    "Time-loop heist to steal a sunrise",
    "A haunted VR game learns to protect players",
  ]
  if request.method == 'POST':
    idea = (request.form.get('idea') or '').strip()
    if idea:
      board = service.generate(idea)
      board_data = {
        'idea': board.idea,
        'beats': [
          { 'title': b.title, 'description': b.description, 'image_prompt': b.image_prompt }
          for b in board.beats
        ],
        'notes': board.notes,
      }
  return render_template_string(TEMPLATE, idea=idea, board=board, board_data=board_data, suggestions=suggestions)


if __name__ == '__main__':
  app.run(host='0.0.0.0', port=7860, debug=True)
