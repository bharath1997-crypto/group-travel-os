from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any
from datetime import datetime
import os
import tempfile

from workers.pdf.export import build_pdf

app = FastAPI(title="Storyboard API", version="0.1.0")


class Panel(BaseModel):
    i: int
    caption: str
    dialogue: str


class Page(BaseModel):
    page: int
    panels: List[Panel]


class Plan(BaseModel):
    title: str
    style: str
    pages: List[Page]


class PlanRequest(BaseModel):
    topic: str
    pages: Literal[5, 10, 15] = Field(..., description="Number of pages")
    style: Literal["educational", "manga", "noir", "pixar_like", "sketch"]


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/generate/plan")
async def generate_plan(req: PlanRequest) -> Dict[str, Any]:
    # deterministic stub content
    title = f"Storyboard: {req.topic.title()}"
    pages = []
    for p in range(1, req.pages + 1):
        panels = []
        for i in range(1, 5):
            panels.append(
                {
                    "i": i,
                    "caption": f"{req.style.capitalize()} - Page {p} Panel {i}",
                    "dialogue": f"{req.topic} - scene {p}.{i}"
                }
            )
        pages.append({"page": p, "panels": panels})
    return {"title": title, "style": req.style, "pages": pages}


class ExportRequest(BaseModel):
    plan: Plan


@app.post("/export/pdf")
async def export_pdf(req: ExportRequest) -> Dict[str, Any]:
    try:
        fd, out_path = tempfile.mkstemp(prefix="storyboard_", suffix=".pdf")
        os.close(fd)
        build_pdf(req.plan.model_dump(), out_path)
        return {"ok": True, "path": out_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
