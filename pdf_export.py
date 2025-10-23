from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet


def build_pdf(plan: dict, out_path: str):
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    story = [Paragraph(plan.get("title", "Storyboard Comic"), styles["Title"]), Spacer(1, 12)]
    pages = plan.get("pages", [])
    for i, page in enumerate(pages):
        story.append(Paragraph(f"Page {page.get('page', i+1)}", styles["Heading2"]))
        grid = []
        row = []
        for panel in page.get("panels", []):
            cell = [Paragraph(panel.get("caption", ""), styles["Normal"]), Spacer(1, 6)]
            row.append(cell)
            if len(row) == 2:
                grid.append(row)
                row = []
        if row:
            grid.append(row)
        story.append(Table(grid, colWidths="*"))
        if i < len(pages) - 1:
            story.append(PageBreak())
    doc.build(story)
