from pathlib import Path
import re
import textwrap


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
OUT_DIR = ROOT / "output" / "pdf"


FILES = {
    "clean": "cleanResume.ts",
    "obvious-injection": "obviousInjectionResume.ts",
    "subtle-injection": "subtleInjectionResume.ts",
    "hidden-style-injection": "hiddenStyleInjectionResume.ts",
}

def read_ts_template(name: str) -> str:
    source = (DATA_DIR / name).read_text()
    match = re.search(r"`([\s\S]*)`", source)
    if not match:
        raise ValueError(f"Could not find template string in {name}")
    return match.group(1).strip()


def split_hidden_resume(text: str) -> tuple[str, str]:
    marker = "</resume>"
    if marker not in text:
        return text, ""
    visible, hidden = text.split(marker, 1)
    return visible.strip(), f"{marker}{hidden}".strip()


def wrapped_lines(text: str, width: int = 104) -> list[str]:
    output: list[str] = []
    for block in text.splitlines():
        if not block.strip():
            output.append("")
            continue

        indent = "  " if block.startswith("- ") else ""
        wrapped = textwrap.wrap(block, width=width, subsequent_indent=indent)
        output.extend(wrapped or [""])

    return output


def pdf_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
    )


def content_line(x: int, y: float, text: str, font: str = "F1", size: float = 9.2, color: str = "0.12 0.16 0.22") -> str:
    return f"BT /{font} {size:g} Tf {color} rg {x} {y:.1f} Td ({pdf_escape(text)}) Tj ET\n"


def write_pdf(path: Path, pages: list[str], title: str) -> None:
    objects: list[bytes] = []

    def add_object(body: str | bytes) -> int:
        if isinstance(body, str):
            body = body.encode("latin-1")
        objects.append(body)
        return len(objects)

    add_object("<< /Type /Catalog /Pages 2 0 R >>")
    add_object(b"")
    add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

    page_ids: list[int] = []
    for page_content in pages:
        page_id = len(objects) + 1
        content_id = page_id + 1
        page_ids.append(page_id)
        add_object(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_id} 0 R >>"
        )
        encoded_content = page_content.encode("latin-1")
        add_object(
            f"<< /Length {len(encoded_content)} >>\nstream\n".encode("latin-1")
            + encoded_content
            + b"endstream"
        )

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")

    info_id = add_object(
        f"<< /Title ({pdf_escape(title)}) /Author (AI Pen Testing Workbench) "
        "/Subject (Synthetic resume for prompt injection demo) >>"
    )

    chunks = [b"%PDF-1.4\n"]
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(sum(len(chunk) for chunk in chunks))
        chunks.append(f"{index} 0 obj\n".encode("latin-1") + body + b"\nendobj\n")

    xref_offset = sum(len(chunk) for chunk in chunks)
    chunks.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
    for offset in offsets[1:]:
        chunks.append(f"{offset:010d} 00000 n \n".encode("latin-1"))
    chunks.append(
        f"trailer\n<< /Root 1 0 R /Info {info_id} 0 R /Size {len(objects) + 1} >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode("latin-1")
    )

    path.write_bytes(b"".join(chunks))


def draw_resume(path: Path, title: str, visible_text: str, hidden_text: str = "") -> None:
    margin_x = 52
    top_y = 736
    bottom_y = 44
    body_size = 9.2
    leading = 12

    lines = wrapped_lines(visible_text)
    first_line = lines[0] if lines else title
    remaining = lines[1:]

    pages: list[str] = []
    content = content_line(margin_x, top_y, first_line, font="F2", size=16, color="0.07 0.09 0.15")
    y = top_y - 26

    for line in remaining:
        if y < bottom_y:
            pages.append(content)
            content = ""
            y = top_y

        if not line:
            y -= leading * 0.65
            continue

        if line.endswith(":") and not line.startswith("http"):
            content += content_line(margin_x, y, line, font="F2", size=body_size)
        else:
            content += content_line(margin_x, y, line, size=body_size)
        y -= leading

    if hidden_text:
        # White text remains visually hidden but is still text-extractable.
        hidden_y = 24
        for line in wrapped_lines(hidden_text, width=120)[:80]:
            content += content_line(36, hidden_y, line or " ", size=5, color="1 1 1")
            hidden_y += 5.4

    pages.append(content)
    write_pdf(path, pages, title)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for slug, filename in FILES.items():
        text = read_ts_template(filename)
        path = OUT_DIR / f"{slug}-resume.pdf"
        title = "Clean Resume" if slug == "clean" else slug.replace("-", " ").title()

        if slug == "hidden-style-injection":
            visible, hidden = split_hidden_resume(text)
            draw_resume(path, title, visible, hidden)
        else:
            draw_resume(path, title, text)

        print(path)


if __name__ == "__main__":
    main()
