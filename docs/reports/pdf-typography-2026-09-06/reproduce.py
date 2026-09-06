"""Render isolated audit candidates; never changes the production template.

Requires Python 3, Typst 0.15.0, and Poppler's pdftoppm on PATH.
Run from any directory. Results go to a fresh temporary directory.
"""

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = Path(tempfile.mkdtemp(prefix="glyphweave-typography-"))
template = (HERE / "baseline.typ").read_text()
old = '  show regex("[A-Za-z0-9]+"): it => box(move(dy: 0.04em, it))'
assert template.count(old) == 1, "Template changed; update the audit's baseline first."
source = OUT / "source"
shutil.copytree(ROOT / "examples/astro-blog/content/typst-posts/hnsw-search-notes", source)
shutil.copyfile(HERE / "probe.typ", OUT / "probe.typ")
variants = {
    "baseline": old,
    "text-baseline": '  show regex("[A-Za-z0-9]+"): set text(baseline: 0.04em)',
    "native": "",
}
results = {
    "compiler": subprocess.check_output(["typst", "--version"], text=True).strip(),
    "template_sha256": hashlib.sha256(template.encode()).hexdigest(),
    "variants": {},
}
for name, rule in variants.items():
    (OUT / f"{name}.typ").write_text(template.replace(old, rule))
    wrapper = OUT / f"demo-{name}.typ"
    wrapper.write_text(
        f'#import "{name}.typ": glyphweave-pdf\n'
        '#show: glyphweave-pdf\n'
        '#include "source/index.typ"\n'
        '#include "probe.typ"\n'
    )
    pdf = OUT / f"{name}.pdf"
    with (OUT / f"{name}.log").open("w") as log:
        subprocess.run(
            ["typst", "compile", "--root", str(OUT), str(wrapper), str(pdf)],
            stderr=log, check=True,
        )
    query = subprocess.run(
        ["typst", "query", "--root", str(OUT), str(wrapper), "metadata", "--field", "value"],
        capture_output=True, text=True, check=True,
    )
    results["variants"][name] = json.loads(query.stdout)
    subprocess.run(
        ["pdftoppm", "-r", "120", "-png", str(pdf), str(OUT / name)], check=True,
    )
(OUT / "metrics.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
print(OUT)
print(json.dumps(results, ensure_ascii=False, indent=2))
