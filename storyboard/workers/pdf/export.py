from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from typing import Dict, Any, List


def build_pdf(plan: Dict[str, Any], out_path: str) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(out_path, pagesize=A4, rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)

    story: List[Any] = []

    title_text = plan.get("title", "Storyboard")
    title_para = Paragraph(f"<b>{title_text}</b>", styles['Title'])
    story.append(title_para)
    story.append(Spacer(1, 12))

    pages = plan.get("pages", [])

    for page in pages:
        page_num = page.get("page")
        story.append(Paragraph(f"Page {page_num}", styles['Heading2']))
        story.append(Spacer(1, 8))

        # Build 2x2 grid; each cell contains a placeholder box and caption
        data = []
        panels = page.get("panels", [])
        cells = []
        for idx in range(4):
            if idx < len(panels):
                panel = panels[idx]
                caption = panel.get("caption", "")
                dialogue = panel.get("dialogue", "")
                cell_content = Paragraph(f"<b>{caption}</b><br/>{dialogue}", styles['BodyText'])
            else:
                cell_content = Paragraph("", styles['BodyText'])
            cells.append(cell_content)
        data.append(cells[:2])
        data.append(cells[2:])

        tbl = Table(data, colWidths=[(A4[0]-40)/2]*2, rowHeights=[120, 120])
        tbl.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOX', (0,0), (-1,-1), 1, colors.black),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))

        story.append(tbl)
        story.append(Spacer(1, 24))

    doc.build(story)
