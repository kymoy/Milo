"""Convert Milo Updates.md to a styled PDF."""
import re
from pathlib import Path
from fpdf import FPDF

# Map common Unicode typographic chars to latin-1 equivalents
_CHAR_MAP = str.maketrans({
    '—': '--',    # em dash
    '–': '-',     # en dash
    '‘': "'",     # left single quote
    '’': "'",     # right single quote
    '“': '"',     # left double quote
    '”': '"',     # right double quote
    '…': '...',   # ellipsis
    '•': '-',     # bullet
    '·': '.',     # middle dot
    '→': '->',    # right arrow
    '←': '<-',    # left arrow
    '×': 'x',     # multiplication sign
    '®': '(R)',   # registered
    '©': '(C)',   # copyright
    '°': 'deg',   # degree
})

def _safe(text: str) -> str:
    text = text.translate(_CHAR_MAP)
    return text.encode('latin-1', errors='replace').decode('latin-1')

MD_PATH  = Path(__file__).parent / "Milo Updates.md"
PDF_PATH = Path(__file__).parent / "Milo Updates.pdf"

# ── Colours ──────────────────────────────────────────────────────────────────
BG        = (15,  17,  36)    # dark navy page background
H1_COL    = (255, 255, 255)   # white
H2_COL    = (180, 200, 255)   # light blue
H3_COL    = (140, 160, 220)
TEXT_COL  = (220, 225, 240)
MUTED_COL = (140, 150, 180)
ACCENT    = (96,  165, 250)   # blue accent
ADD_COL   = (74,  222, 128)   # green  → Added
CHG_COL   = (250, 204,  21)   # yellow → Changed
REM_COL   = (248, 113, 113)   # red    → Removed
SEC_COL   = (251, 146,  60)   # orange → Security / Notes
RULE_COL  = (40,  50,  80)    # divider line

MARGIN = 18
W      = 210 - MARGIN * 2   # usable width (A4)


class MiloPDF(FPDF):
    def header(self):
        pass

    def footer(self):
        self.set_y(-13)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED_COL)
        self.cell(0, 8, f"Milo Updates  ·  Page {self.page_no()}", align="C")


def badge_color(section_title: str):
    t = section_title.lower()
    if "added"    in t: return ADD_COL
    if "changed"  in t: return CHG_COL
    if "removed"  in t: return REM_COL
    if "security" in t: return SEC_COL
    if "notes"    in t: return MUTED_COL
    if "bug"      in t: return (251, 113, 133)
    return MUTED_COL


def render_inline(pdf, text: str, base_size: float, base_color, x_start: float, max_w: float):
    """Render a single line with **bold** and `code` inline spans, word-wrapping."""
    # Split into styled segments
    segments = []
    pattern = re.compile(r'\*\*(.+?)\*\*|`(.+?)`')
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            segments.append(("normal", text[last:m.start()]))
        if m.group(1):
            segments.append(("bold", m.group(1)))
        else:
            segments.append(("code", m.group(2)))
        last = m.end()
    if last < len(text):
        segments.append(("normal", text[last:]))

    # Word-wrap across segments
    line_words: list[tuple[str, str]] = []   # (style, word)
    for style, seg in segments:
        for word in re.split(r'(\s+)', seg):
            if word:
                line_words.append((style, word))

    pdf.set_x(x_start)
    cur_x = x_start
    line_h = base_size * 0.45 + 1.5

    def flush_line():
        pdf.ln(line_h)
        pdf.set_x(x_start)

    for style, word in line_words:
        if style == "bold":
            pdf.set_font("Helvetica", "B", base_size)
            pdf.set_text_color(*base_color)
        elif style == "code":
            pdf.set_font("Courier", "", base_size - 0.5)
            pdf.set_text_color(*ACCENT)
        else:
            pdf.set_font("Helvetica", "", base_size)
            pdf.set_text_color(*base_color)

        w = pdf.get_string_width(_safe(word))
        if cur_x + w > x_start + max_w and cur_x > x_start:
            flush_line()
            cur_x = x_start

        pdf.set_x(cur_x)
        pdf.cell(w, line_h, _safe(word))
        cur_x += w

    pdf.ln(line_h)


def main():
    raw = MD_PATH.read_text(encoding="utf-8")
    lines = raw.splitlines()

    pdf = MiloPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.set_margins(MARGIN, MARGIN, MARGIN)
    pdf.add_page()
    pdf.set_fill_color(*BG)
    pdf.rect(0, 0, 210, 297, "F")

    current_section_color = MUTED_COL
    in_bullet = False

    for raw_line in lines:
        line = raw_line.rstrip()

        # ── Page background ───────────────────────────────────────────────
        # (fpdf fills per-page via add_page; re-fill if needed is done above)

        # ── H1 ──────────────────────────────────────────────────────────────
        if line.startswith("# ") and not line.startswith("## "):
            in_bullet = False
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 22)
            pdf.set_text_color(*H1_COL)
            pdf.multi_cell(W, 9, _safe(line[2:].strip()))
            pdf.set_draw_color(*ACCENT)
            pdf.set_line_width(0.5)
            pdf.line(MARGIN, pdf.get_y() + 1, MARGIN + W, pdf.get_y() + 1)
            pdf.ln(5)
            continue

        # ── H2 (date headers) ────────────────────────────────────────────────
        if line.startswith("## "):
            in_bullet = False
            pdf.ln(6)
            text = line[3:].strip()
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(*H2_COL)
            pdf.multi_cell(W, 6, _safe(text))
            pdf.set_draw_color(*ACCENT)
            pdf.set_line_width(0.3)
            pdf.line(MARGIN, pdf.get_y() + 1, MARGIN + W, pdf.get_y() + 1)
            pdf.ln(3)
            continue

        # ── H3 (Added / Changed / Removed …) ─────────────────────────────
        if line.startswith("### "):
            in_bullet = False
            text = line[4:].strip()
            current_section_color = badge_color(text)
            pdf.ln(4)
            # coloured pill
            pdf.set_fill_color(*current_section_color)
            pdf.set_text_color(*BG)
            pdf.set_font("Helvetica", "B", 9)
            lbl_w = pdf.get_string_width(text.upper()) + 8
            pdf.set_x(MARGIN)
            pdf.cell(lbl_w, 5, _safe(text.upper()), fill=True)
            pdf.ln(6)
            continue

        # ── HR ───────────────────────────────────────────────────────────────
        if line.strip() == "---":
            in_bullet = False
            pdf.ln(3)
            pdf.set_draw_color(*RULE_COL)
            pdf.set_line_width(0.4)
            pdf.line(MARGIN, pdf.get_y(), MARGIN + W, pdf.get_y())
            pdf.ln(5)
            continue

        # ── Bullet ───────────────────────────────────────────────────────────
        if line.startswith("- "):
            in_bullet = True
            content = line[2:].strip()
            # strip leading **label**: pattern for the bold title
            indent = MARGIN + 5
            bullet_w = W - 5

            # draw bullet dot
            pdf.set_x(MARGIN + 1)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*current_section_color)
            pdf.cell(4, 4.5, "-")

            render_inline(pdf, content, 9, TEXT_COL, indent, bullet_w)
            pdf.ln(0.5)
            continue

        # ── Blank line ───────────────────────────────────────────────────────
        if not line.strip():
            in_bullet = False
            pdf.ln(2)
            continue

        # ── Plain paragraph ──────────────────────────────────────────────────
        in_bullet = False
        render_inline(pdf, line, 9, TEXT_COL, MARGIN, W)

    # ── Save ──────────────────────────────────────────────────────────────────
    pdf.output(str(PDF_PATH))
    print(f"Saved: {PDF_PATH}")


if __name__ == "__main__":
    main()
