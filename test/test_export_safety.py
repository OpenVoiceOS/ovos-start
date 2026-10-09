"""Run the actual downloadable start script with isolated, network-free curl."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
SHELLS = ["/bin/sh", "/bin/bash"]
if os.environ.get("DASH_BIN"):
    SHELLS.append(os.environ["DASH_BIN"])


@pytest.fixture(scope="module")
def script() -> str:
    """Build exactly the production download, with a synthetic launch capability."""
    return subprocess.check_output(
        ["node", "--input-type=module", "-e",
         "import{DEFAULTS}from'./dist/scenario.mjs';"
         "import{issueSetup,buildSetupScript}from'./dist/short-setup.mjs';"
         "console.log(buildSetupScript(issueSetup({...DEFAULTS,device:'computer'}),"
         "undefined,'L'.repeat(22)));"], cwd=ROOT, text=True,
    )


@pytest.mark.parametrize("shell", SHELLS)
@pytest.mark.parametrize("case", ["success", "failure", "empty", "partial", "child-failure", "interrupt", "terminate"])
def test_export_cleans_private_downloads(
    tmp_path: Path, script: str, shell: str, case: str,
) -> None:
    """Reject bad transfers and clean secrets on normal, failed and signalled exits."""
    temp = tmp_path / "temporary files"
    temp.mkdir()
    binary = tmp_path / "bin"
    binary.mkdir()
    marker = tmp_path / "ran"
    permissions = tmp_path / "permissions.json"
    fake = binary / "curl"
    fake.write_text(f"#!{sys.executable}\n" + '''import json, os, pathlib, signal, sys
args=sys.argv[1:]
assert args[:7]==['-qfsS','--proto','=https','--connect-timeout','15','-m','120']
assert args[7]=='https://ovos-install-status.goldyfruit.chatgpt.site/s/'+'L'*22
assert args[8]=='-o' and len(args)==10
target=pathlib.Path(args[9]); case=os.environ['EXPORT_CASE']
body='printf ran > "$EXPORT_MARKER"\\nexit '+('17' if case=='child-failure' else '0')+'\\n'
if case=='empty': body=''
if case=='partial': body='(\\n'+body
target.write_text(body)
pathlib.Path(os.environ['EXPORT_PERMISSIONS']).write_text(json.dumps([target.parent.stat().st_mode&0o777,target.stat().st_mode&0o777]))
if case in ('interrupt','terminate'): os.kill(os.getppid(),signal.SIGINT if case=='interrupt' else signal.SIGTERM)
sys.exit(28 if case=='failure' else 0)
''')
    fake.chmod(0o700)
    env = {**os.environ, "PATH": f"{binary}:{os.environ['PATH']}",
           "TMPDIR": str(temp), "EXPORT_CASE": case,
           "EXPORT_MARKER": str(marker), "EXPORT_PERMISSIONS": str(permissions)}
    result = subprocess.run([shell, "-c", script], env=env, text=True,
                            capture_output=True, timeout=10)
    assert json.loads(permissions.read_text()) == [0o700, 0o600]
    assert list(temp.iterdir()) == []
    assert marker.exists() == (case in ("success", "child-failure"))
    expected = {"success": 0, "child-failure": 17, "interrupt": 130, "terminate": 143}
    assert result.returncode == expected.get(case, 1), result.stderr

