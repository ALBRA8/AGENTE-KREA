#!/usr/bin/env python3
"""
render-pdf.py — KREA Book Factory PDF Renderer

Reads a JSON PDFRenderSpec from stdin and generates a real PDF using ReportLab.
Writes the PDF to the output path specified in the spec.
Prints JSON result to stdout: { success, pageCount, sizeBytes, filePath, error? }

Usage:
    cat spec.json | python3 scripts/render-pdf.py
    echo '{"spec": {...}, "outputPath": "/tmp/book.pdf"}' | python3 scripts/render-pdf.py
"""

import sys
import json
import os
import traceback

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch, mm, cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.lib.colors import HexColor, black, white, Color
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, PageBreak,
        Table, TableStyle, Frame, PageTemplate, BaseDocTemplate,
        KeepTogether, HRFlowable
    )
    from reportlab.pdfgen.canvas import Canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def hex_to_reportlab_color(hex_str):
    """Convert hex color string to ReportLab Color."""
    if not hex_str or not hex_str.startswith("#"):
        return black
    try:
        r = int(hex_str[1:3], 16) / 255.0
        g = int(hex_str[3:5], 16) / 255.0
        b = int(hex_str[5:7], 16) / 255.0
        return Color(r, g, b)
    except (ValueError, IndexError):
        return black


def get_page_size(page_setup):
    """Determine page size from page_setup dimensions."""
    width = page_setup.get("width", 612)  # US Letter width in points
    height = page_setup.get("height", 792)  # US Letter height in points
    # Check standard sizes
    if abs(width - 612) < 5 and abs(height - 792) < 5:
        return letter
    elif abs(width - 595) < 5 and abs(height - 842) < 5:
        return A4
    return (width, height)


def build_styles(spec):
    """Build ParagraphStyles from the spec's font definitions."""
    styles = getSampleStyleSheet()

    # Custom heading styles from spec fonts
    fonts = spec.get("fonts", [])
    heading_font = "Helvetica-Bold"
    body_font = "Helvetica"
    mono_font = "Courier"

    for f in fonts:
        family = f.get("family", "").lower()
        if "heading" in f.get("name", "").lower() or "bold" in family:
            heading_font = "Helvetica-Bold"
        elif "mono" in f.get("name", "").lower():
            mono_font = "Courier"
        elif "body" in f.get("name", "").lower():
            body_font = "Helvetica"

    # Override heading styles
    styles.add(ParagraphStyle(
        name='KreaH1',
        parent=styles['Heading1'],
        fontName=heading_font,
        fontSize=24,
        leading=30,
        spaceAfter=18,
        spaceBefore=24,
        alignment=TA_LEFT,
    ))

    styles.add(ParagraphStyle(
        name='KreaH2',
        parent=styles['Heading2'],
        fontName=heading_font,
        fontSize=18,
        leading=22,
        spaceAfter=12,
        spaceBefore=16,
        alignment=TA_LEFT,
    ))

    styles.add(ParagraphStyle(
        name='KreaH3',
        parent=styles['Heading3'],
        fontName=heading_font,
        fontSize=14,
        leading=18,
        spaceAfter=8,
        spaceBefore=12,
        alignment=TA_LEFT,
    ))

    styles.add(ParagraphStyle(
        name='KreaBody',
        parent=styles['Normal'],
        fontName=body_font,
        fontSize=11,
        leading=15,
        spaceAfter=8,
        spaceBefore=2,
        alignment=TA_JUSTIFY,
        firstLineIndent=0,
    ))

    styles.add(ParagraphStyle(
        name='KreaQuote',
        parent=styles['Normal'],
        fontName=body_font,
        fontSize=10,
        leading=14,
        spaceAfter=10,
        spaceBefore=6,
        leftIndent=36,
        rightIndent=36,
        alignment=TA_JUSTIFY,
        textColor=HexColor('#444444'),
    ))

    styles.add(ParagraphStyle(
        name='KreaMono',
        parent=styles['Normal'],
        fontName=mono_font,
        fontSize=9,
        leading=12,
        spaceAfter=6,
        spaceBefore=4,
    ))

    styles.add(ParagraphStyle(
        name='KreaCaption',
        parent=styles['Normal'],
        fontName=body_font,
        fontSize=9,
        leading=11,
        spaceAfter=6,
        alignment=TA_CENTER,
        textColor=HexColor('#666666'),
    ))

    return styles


def build_cover_page(cover, styles):
    """Build flowables for the cover page."""
    elements = []

    # Large spacer to push title down
    elements.append(Spacer(1, 2 * inch))

    # Title
    title = cover.get("title", "")
    if title:
        cover_title_style = ParagraphStyle(
            name='CoverTitle',
            parent=styles['KreaH1'],
            fontSize=32,
            leading=38,
            alignment=TA_CENTER,
            spaceAfter=24,
        )
        elements.append(Paragraph(title, cover_title_style))

    # Subtitle
    subtitle = cover.get("subtitle", "")
    if subtitle:
        cover_subtitle_style = ParagraphStyle(
            name='CoverSubtitle',
            parent=styles['KreaBody'],
            fontSize=16,
            leading=20,
            alignment=TA_CENTER,
            textColor=HexColor('#555555'),
            spaceAfter=36,
        )
        elements.append(Paragraph(subtitle, cover_subtitle_style))

    # Author
    author = cover.get("author", "")
    if author:
        cover_author_style = ParagraphStyle(
            name='CoverAuthor',
            parent=styles['KreaBody'],
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            textColor=HexColor('#333333'),
        )
        elements.append(Paragraph(f"by {author}", cover_author_style))

    elements.append(PageBreak())
    return elements


def build_toc(spec, styles):
    """Build a Table of Contents page."""
    elements = []

    elements.append(Paragraph("Table of Contents", styles['KreaH1']))
    elements.append(Spacer(1, 18))

    pages = spec.get("pages", [])
    seen_chapters = set()

    for page in pages:
        if page.get("is_chapter_opening") and page.get("chapter_number"):
            ch_num = page["chapter_number"]
            if ch_num in seen_chapters:
                continue
            seen_chapters.add(ch_num)

            # Find the chapter heading text
            ch_title = f"Chapter {ch_num}"
            for elem in page.get("elements", []):
                if elem.get("type") == "heading":
                    content = elem.get("content", "").strip()
                    if content:
                        ch_title = content
                    break

            # Dot leader style TOC entry
            toc_style = ParagraphStyle(
                name=f'TOCEntry{ch_num}',
                parent=styles['KreaBody'],
                fontSize=12,
                leading=18,
                spaceAfter=6,
            )
            page_num = page.get("page_number", ch_num + 1)
            elements.append(Paragraph(
                f"{ch_title} {'.' * 40} {page_num}",
                toc_style
            ))

    elements.append(PageBreak())
    return elements


def build_body_pages(spec, styles):
    """Build flowables for all body pages."""
    elements = []
    pages = spec.get("pages", [])

    for page_idx, page in enumerate(pages):
        is_chapter_opening = page.get("is_chapter_opening", False)

        for elem in page.get("elements", []):
            elem_type = elem.get("type", "paragraph")
            content = elem.get("content", "").strip()
            style_overrides = elem.get("style", {})

            if not content and elem_type not in ("page_break", "decoration"):
                continue

            if elem_type == "heading":
                # Determine heading level from style or content
                level = style_overrides.get("level", 1)
                if "h3" in style_overrides.get("class", "").lower() or level >= 3:
                    style = styles['KreaH3']
                elif "h2" in style_overrides.get("class", "").lower() or level == 2:
                    style = styles['KreaH2']
                else:
                    style = styles['KreaH1']
                elements.append(Paragraph(content, style))

            elif elem_type == "paragraph":
                # Handle drop_cap
                if style_overrides.get("drop_cap"):
                    elements.append(Paragraph(
                        f'<font size="28">{content[0]}</font>{content[1:]}',
                        styles['KreaBody']
                    ))
                else:
                    elements.append(Paragraph(content, styles['KreaBody']))

            elif elem_type == "quote":
                elements.append(Paragraph(f'<i>"{content}"</i>', styles['KreaQuote']))

            elif elem_type == "list":
                # Simple bullet list item
                list_style = ParagraphStyle(
                    name=f'ListItem_{page_idx}',
                    parent=styles['KreaBody'],
                    leftIndent=24,
                    bulletIndent=12,
                    spaceAfter=4,
                )
                elements.append(Paragraph(f"\u2022  {content}", list_style))

            elif elem_type == "caption":
                elements.append(Paragraph(content, styles['KreaCaption']))

            elif elem_type == "image":
                # Placeholder for image (actual embedding would need file path)
                img_placeholder = ParagraphStyle(
                    name=f'ImgPlaceholder_{page_idx}',
                    parent=styles['KreaBody'],
                    alignment=TA_CENTER,
                    textColor=HexColor('#999999'),
                    spaceAfter=12,
                )
                w = elem.get("width", 200)
                h = elem.get("height", 150)
                elements.append(Paragraph(
                    f"[Image: {w}x{h}pt — {content}]",
                    img_placeholder
                ))

            elif elem_type == "table":
                # Simple table rendering
                rows = content.split("\n")
                table_data = [row.split("|") for row in rows if row.strip()]
                if table_data:
                    t = Table(table_data)
                    t.setStyle(TableStyle([
                        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#CCCCCC')),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ]))
                    elements.append(t)

            elif elem_type == "page_break":
                elements.append(PageBreak())

            elif elem_type == "decoration":
                # Horizontal rule
                elements.append(HRFlowable(
                    width="80%", thickness=0.5,
                    color=HexColor('#CCCCCC'),
                    spaceAfter=8, spaceBefore=8,
                ))

            elif elem_type == "drop_cap":
                if len(content) > 0:
                    elements.append(Paragraph(
                        f'<font size="28">{content[0]}</font>{content[1:]}',
                        styles['KreaBody']
                    ))

        # Add page break between pages (except the last)
        if page_idx < len(pages) - 1:
            next_page = pages[page_idx + 1]
            # Only add explicit page break if the next page is a chapter opening
            # (SimpleDocTemplate handles page breaks automatically)
            if next_page.get("is_chapter_opening"):
                elements.append(PageBreak())

    return elements


def render_pdf(spec, output_path):
    """
    Render a PDF from a PDFRenderSpec using ReportLab.

    Returns dict with: success, pageCount, sizeBytes, filePath
    """
    if not REPORTLAB_AVAILABLE:
        return {
            "success": False,
            "pageCount": 0,
            "sizeBytes": 0,
            "filePath": None,
            "error": "reportlab is not installed"
        }

    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        # Page setup
        page_setup = spec.get("page_setup", {})
        page_size = get_page_size(page_setup)
        margins = page_setup.get("margins", {})

        # Build document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=page_size,
            topMargin=margins.get("top", 72),
            bottomMargin=margins.get("bottom", 72),
            leftMargin=margins.get("inner", 72),
            rightMargin=margins.get("outer", 72),
            title=spec.get("metadata", {}).get("title", "KREA Book"),
            author=spec.get("metadata", {}).get("author", ""),
            subject=spec.get("metadata", {}).get("subject", ""),
            creator=spec.get("metadata", {}).get("creator", "KREA-PDF-Factory"),
        )

        # Build styles
        styles = build_styles(spec)

        # Build all flowables
        flowables = []

        # Cover page
        cover = spec.get("cover", {})
        if cover and cover.get("title"):
            flowables.extend(build_cover_page(cover, styles))

        # Table of Contents
        toc_config = spec.get("toc", {})
        if toc_config.get("enabled", False):
            flowables.extend(build_toc(spec, styles))

        # Body pages
        flowables.extend(build_body_pages(spec, styles))

        # Build the PDF
        doc.build(flowables)

        # Verify the output
        file_size = os.path.getsize(output_path)

        # Count pages (quick: scan for /Type /Page entries)
        page_count = 0
        with open(output_path, "rb") as f:
            content = f.read()
            # Count Page objects (not PageTree)
            page_count = content.count(b"/Type /Page") - content.count(b"/Type /Pages")
            if page_count <= 0:
                # Fallback: count page markers another way
                page_count = content.count(b"/Type /Page")
            if page_count <= 0:
                page_count = 1  # At least one page

        return {
            "success": True,
            "pageCount": page_count,
            "sizeBytes": file_size,
            "filePath": output_path,
        }

    except Exception as e:
        return {
            "success": False,
            "pageCount": 0,
            "sizeBytes": 0,
            "filePath": None,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def main():
    """Read JSON from stdin and render the PDF."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        result = {
            "success": False,
            "pageCount": 0,
            "sizeBytes": 0,
            "filePath": None,
            "error": f"Invalid JSON input: {e}"
        }
        print(json.dumps(result))
        sys.exit(1)

    # Support both direct spec and wrapped spec
    spec = input_data.get("spec", input_data)
    output_path = input_data.get("outputPath", "/tmp/krea-output.pdf")

    result = render_pdf(spec, output_path)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
