from pathlib import Path
import shutil
import textwrap


def save_as(content: str, path: Path | str) -> None:
    target_path = Path(path)
    playbooks_dir = target_path.parent

    if not playbooks_dir.exists():
        playbooks_dir.mkdir(parents=True, exist_ok=True)

    target_path.write_text(content, encoding="utf-8")


# ------- Simple terminal UI helpers (no external deps) -------

# ANSI styles
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

# Colors
FG_YELLOW = "\033[33m"
FG_CYAN = "\033[36m"
FG_GREEN = "\033[32m"
FG_GREY = "\033[90m"


def _term_width(default: int = 80) -> int:
    try:
        return shutil.get_terminal_size((default, 20)).columns
    except Exception:
        return default


def _wrap_text(text: str, width: int) -> list[str]:
    wrapped: list[str] = []
    for paragraph in text.splitlines() or [""]:
        if not paragraph.strip():
            wrapped.append("")
            continue
        wrapped.extend(
            textwrap.fill(
                paragraph,
                width=width,
                replace_whitespace=False,
                break_long_words=False,
            ).splitlines()
        )
    return wrapped


def print_status(message: str) -> None:
    """Show a lightweight status line indicating agent work."""
    print(f"{FG_YELLOW}[WORKING]{RESET} {message}")


def print_agent_block(text: str, title: str = "Agent") -> None:
    """Render agent output in a simple boxed block for clarity."""
    term_w = max(40, min(_term_width(), 100))
    content_w = term_w - 4  # padding for borders
    lines = _wrap_text(text.strip(), content_w)
    title_str = f" {title} "
    top_border = "+" + "-" * (term_w - 2) + "+"
    title_line = "|" + (title_str.ljust(term_w - 2)) + "|"
    print(FG_CYAN + top_border + RESET)
    print(FG_CYAN + title_line + RESET)
    print(FG_CYAN + ("|" + " " * (term_w - 2) + "|") + RESET)
    for line in lines:
        padded = line.ljust(content_w)
        print(FG_CYAN + "| " + RESET + padded + FG_CYAN + " |" + RESET)
    print(FG_CYAN + top_border + RESET)


def prompt_input(prompt: str) -> str:
    """Prompt clearly when it's the user's turn to type."""
    label = f"{FG_GREEN}[YOUR TURN]{RESET} {prompt}"
    print(label)
    return input("› ").strip()

