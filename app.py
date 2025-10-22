from flask import Flask, render_template_string, request
from ai_storyboard.providers.mock import MockProvider
from ai_storyboard.service import StoryboardService

app = Flask(__name__)
service = StoryboardService(provider=MockProvider())

TEMPLATE = '''
<!doctype html>
<title>AI Storyboard</title>
<style>
body{font-family:system-ui,Segoe UI,Arial;margin:2rem;}
.container{max-width:900px;margin:auto}
.beat{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0;background:#fafafa}
header{display:flex;align-items:center;gap:12px}
button{background:#111827;color:white;border:none;padding:10px 16px;border-radius:8px;cursor:pointer}
textarea{width:100%;min-height:120px;padding:10px;border-radius:8px;border:1px solid #d1d5db}
pre{background:#111827;color:#e5e7eb;padding:10px;border-radius:8px;overflow:auto}
</style>
<div class="container">
  <h1>AI Storyboard</h1>
  <form method="post">
    <label for="idea">Idea</label>
    <textarea name="idea" id="idea" placeholder="Describe your story idea...">{{ idea or '' }}</textarea>
    <div style="margin-top:10px"><button type="submit">Generate</button></div>
  </form>
  {% if board %}
    <h2>Beats</h2>
    {% for b in board.beats %}
      <div class="beat">
        <header><strong>{{ loop.index }}. {{ b.title }}</strong></header>
        <div>{{ b.description }}</div>
        <small>Image prompt: {{ b.image_prompt }}</small>
      </div>
    {% endfor %}
    {% if board.notes %}<h3>Notes</h3><pre>{{ board.notes }}</pre>{% endif %}
  {% endif %}
</div>
'''

@app.route('/', methods=['GET','POST'])
def index():
    idea = ''
    board = None
    if request.method == 'POST':
        idea = request.form.get('idea','').strip()
        if idea:
            board = service.generate(idea)
    return render_template_string(TEMPLATE, idea=idea, board=board)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860, debug=True)
