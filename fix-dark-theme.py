"""Fix remaining text-black issues in dark-theme pages."""
import os

PAGES = [
    "app/(root)/feedback/page.tsx",
    "app/(root)/progress/page.tsx",
    "app/(root)/improvement-plan/page.tsx",
]

for filepath in PAGES:
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filepath}")
        continue

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Fix double text-black (e.g. "text-black text-black")
    content = content.replace("text-black text-black", "text-foreground")

    # Fix text-black in status badge conditionals
    content = content.replace(
        "text-primary-foreground border border-primary/30' : 'bg-white/5 text-black/60",
        "text-primary border border-primary/30' : 'bg-white/5 text-muted-foreground",
    )
    content = content.replace(
        "text-black border border-primary/30' : 'bg-white/5 text-black/50",
        "text-foreground border border-primary/30' : 'bg-white/5 text-muted-foreground",
    )

    # General: replace standalone text-black with text-foreground
    # but only where it's NOT inside a bg-colored badge (those are intentionally dark text on light bg)
    # We do a safe line-by-line replacement
    fixed_lines = []
    for line in content.splitlines(keepends=True):
        # Don't touch lines with colored badge backgrounds where dark text is intentional
        # e.g. bg-yellow-500 text-black, bg-gray-400 text-black, bg-orange-500 text-black
        if any(x in line for x in [
            "bg-yellow-500", "bg-gray-400", "bg-orange-500",
            "bg-green-600", "bg-blue-600", "bg-yellow-600"
        ]):
            fixed_lines.append(line)
        else:
            fixed_lines.append(line.replace("text-black", "text-foreground"))
    content = "".join(fixed_lines)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"FIXED: {filepath}")
    else:
        print(f"NO CHANGE: {filepath}")
