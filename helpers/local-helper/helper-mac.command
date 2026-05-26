#!/bin/bash
set -euo pipefail

PORT="${NSDH_HELPER_PORT:-4173}"
APEX_ORIGIN="${NSDH_APEX_ORIGIN:-https://apex.oraclecorp.com}"
HELPER_FILE="${TMPDIR:-/tmp}/nsdemohelper-local-helper.py"

cat > "$HELPER_FILE" <<'PY_HELPER'
#!/usr/bin/env python3
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("NSDH_HELPER_PORT", "4173"))
APEX_ORIGIN = os.environ.get("NSDH_APEX_ORIGIN", "https://apex.oraclecorp.com")
STATE = {
    "guide": "",
    "scRunbook": "",
    "assetGenerationPrompt": "",
    "setupPrompt": "",
    "dryRunCreationPrompt": "",
    "preDemoIntelligence": None,
    "demoIntelligence": None,
    "lastGeneratedAt": ""
}

ERRORS = {
    "helper_not_running": "HELPER_NOT_RUNNING",
    "codex_not_available": "CODEX_NOT_AVAILABLE",
    "generation_timeout": "GENERATION_TIMEOUT",
    "invalid_response": "HELPER_INVALID_RESPONSE"
}


def allowed_origin(origin):
    if not origin:
        return APEX_ORIGIN
    if origin == APEX_ORIGIN:
        return origin
    if re.match(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", origin):
        return origin
    return APEX_ORIGIN


def codex_command():
    explicit = os.environ.get("CODEX_BIN", "").strip()
    candidates = [explicit] if explicit else []
    candidates.extend([
        "/Applications/Codex.app/Contents/Resources/codex",
        shutil.which("codex") or ""
    ])
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    if shutil.which("codex"):
        return "codex"
    return ""


def codex_status():
    command = codex_command()
    if not command:
        return {
            "ok": True,
            "available": False,
            "code": "CODEX_NOT_AVAILABLE",
            "message": "Codex was not found. Open Codex or add it to PATH, then test again."
        }
    try:
        result = subprocess.run([command, "--version"], text=True, capture_output=True, timeout=8)
        available = result.returncode == 0
        return {
            "ok": True,
            "available": available,
            "command": command,
            "version": (result.stdout or result.stderr).strip(),
            "message": "Codex is available." if available else "Codex responded with a non-zero status.",
            "code": "CODEX_LOCAL_CONNECTED" if available else "CODEX_NOT_AVAILABLE"
        }
    except Exception as error:
        return {
            "ok": True,
            "available": False,
            "command": command,
            "code": "CODEX_NOT_AVAILABLE",
            "message": str(error)
        }


def extract_json(text):
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


def run_codex(prompt, timeout=240):
    status = codex_status()
    if not status.get("available"):
        return {
            "ok": False,
            "error": status.get("message", "Codex is not available."),
            "code": "CODEX_NOT_AVAILABLE"
        }
    command = status["command"]
    with tempfile.TemporaryDirectory(prefix="nsdh-helper-") as work_dir:
        output_file = os.path.join(work_dir, "codex-output.txt")
        args = [
            command,
            "--ask-for-approval", "never",
            "exec",
            "-C", work_dir,
            "--sandbox", "read-only",
            "--skip-git-repo-check",
            "--output-last-message", output_file,
            "-"
        ]
        try:
            proc = subprocess.run(args, input=prompt, text=True, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "error": "Codex generation timed out.",
                "code": "GENERATION_TIMEOUT"
            }
        except Exception as error:
            return {
                "ok": False,
                "error": str(error),
                "code": "HELPER_INVALID_RESPONSE"
            }
        output = ""
        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8", errors="replace") as handle:
                output = handle.read()
        if not output:
            output = (proc.stdout or proc.stderr or "").strip()
        if proc.returncode != 0 and not output:
            return {
                "ok": False,
                "error": "Codex exited without returning output.",
                "code": "HELPER_INVALID_RESPONSE"
            }
        return {
            "ok": True,
            "text": output.strip(),
            "json": extract_json(output)
        }


def input_context(body):
    return {
        "companyName": body.get("companyName") or body.get("customerName") or body.get("company") or "",
        "website": body.get("companyUrl") or body.get("website") or "",
        "audience": body.get("audience") or body.get("audienceType") or "",
        "segment": body.get("marketSegment") or body.get("targetSegment") or "",
        "industry": body.get("industry") or "",
        "strategy": body.get("demoStrategy") or "",
        "language": body.get("outputLanguage") or "English",
        "competition": body.get("competition") or "",
        "demoScope": body.get("demoScope") or "",
        "demoRequest": body.get("topic") or body.get("demoRequest") or "",
        "preDemoNotes": body.get("preDemoNotes") or ""
    }


def codex_json_task(task, schema, body):
    context = input_context(body)
    prompt = (
        "You are the Codex backbone for NS DemoHelper. Use the provided customer/demo context. "
        "Return ONLY valid JSON. Do not include markdown fences.\n\n"
        f"Task: {task}\n\n"
        f"Required JSON shape:\n{json.dumps(schema, indent=2)}\n\n"
        f"Context:\n{json.dumps(context, indent=2)}"
    )
    result = run_codex(prompt)
    if not result.get("ok"):
        return result
    return {"ok": True, "json": result.get("json") or {}, "text": result.get("text", "")}


def pre_demo_score(body):
    schema = {
        "score": 0,
        "readinessLabel": "Healthy / Medium / At risk",
        "summary": "short SC-readable summary",
        "strengths": ["list"],
        "missingDiscovery": ["list"],
        "risks": ["list"],
        "recommendedFollowUpQuestions": ["list"],
        "websiteSummary": {"summary": "", "interestingPoints": [], "contradictions": []},
        "recommendations": ["list"]
    }
    result = codex_json_task("Score pre-demo discovery quality and identify what is missing before a proper demo can be created.", schema, body)
    payload = result.get("json") if result.get("ok") else {}
    payload = payload if isinstance(payload, dict) else {}
    website = payload.get("website_context") or payload.get("websiteSummary") or {}
    payload = {
        **payload,
        "overall_score": payload.get("overall_score") or payload.get("score") or 0,
        "readiness_label": payload.get("readiness_label") or payload.get("readinessLabel") or "Not checked",
        "strongest_area": payload.get("strongest_area") or (payload.get("strengths") or [""])[0],
        "biggest_risk": payload.get("biggest_risk") or (payload.get("risks") or [""])[0],
        "next_best_question": payload.get("next_best_question") or (payload.get("recommendedFollowUpQuestions") or [""])[0],
        "missing_discovery_items": payload.get("missing_discovery_items") or payload.get("missingDiscovery") or [],
        "recommended_follow_up_questions": payload.get("recommended_follow_up_questions") or payload.get("recommendedFollowUpQuestions") or [],
        "website_context": website,
        "heatmap": payload.get("heatmap") or [
            {"label": "Discovery quality", "score": payload.get("score") or payload.get("overall_score") or 0, "status": payload.get("readinessLabel") or payload.get("readiness_label") or "Not checked"},
            {"label": "Missing context", "score": max(0, 100 - (len(payload.get("missingDiscovery") or payload.get("missing_discovery_items") or []) * 12)), "status": "Review gaps"}
        ],
        "metadata": {
            "customer_name": input_context(body).get("companyName") or "Current prospect",
            "audience_type": input_context(body).get("audience"),
            "target_segment": input_context(body).get("segment"),
            "industry": input_context(body).get("industry"),
            "demo_strategy": input_context(body).get("strategy")
        }
    }
    output = {
        "ok": True,
        "source": "local-helper-codex",
        "preDemoIntelligence": payload,
        "score": payload.get("overall_score"),
        "summary": payload.get("summary"),
        "error": result.get("error") if not result.get("ok") else None,
        "code": result.get("code") if not result.get("ok") else None
    }
    STATE["preDemoIntelligence"] = payload
    STATE["lastGeneratedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return output


def demo_runbook(body):
    schema = {
        "guide": "complete SC playbook in markdown",
        "scRunbook": "personalized demo story and talk track in markdown",
        "assetGenerationPrompt": "PowerPoint/demo asset generation prompt",
        "setupPrompt": "NetSuite/setup prompt or neutral setup prompt",
        "dryRunCreationPrompt": "instructions for creating a dry-run manifest",
        "preDemoIntelligence": {},
        "demoIntelligence": {}
    }
    result = codex_json_task("Create the demo playbook, story/runbook, setup prompt, asset prompt, dry-run prompt, and intelligence summaries.", schema, body)
    data = result.get("json") if result.get("ok") else {}
    data = data if isinstance(data, dict) else {}
    guide = data.get("guide") or data.get("scRunbook") or result.get("text") or ""
    context = input_context(body)
    STATE.update({
        "guide": guide,
        "scRunbook": data.get("scRunbook") or guide,
        "assetGenerationPrompt": data.get("assetGenerationPrompt") or "",
        "setupPrompt": data.get("setupPrompt") or "",
        "dryRunCreationPrompt": data.get("dryRunCreationPrompt") or "",
        "preDemoIntelligence": data.get("preDemoIntelligence") or STATE.get("preDemoIntelligence"),
        "demoIntelligence": data.get("demoIntelligence") or {},
        "lastGeneratedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    })
    return {
        "ok": True,
        "source": "local-helper-codex",
        "manifest": {
            "title": context.get("companyName") or "NS DemoHelper Local Helper Demo",
            "context": context,
            "segments": [],
            "defaults": {"demoStrategy": context.get("strategy"), "industry": context.get("industry")}
        },
        "guide": STATE["guide"],
        "guideOutputs": {
            "scRunbook": STATE["scRunbook"],
            "assetGenerationPrompt": STATE["assetGenerationPrompt"],
            "dryRunCreationPrompt": STATE["dryRunCreationPrompt"],
            "liveDemoFunctionality": False
        },
        "setupPrompt": {
            "prompt": STATE["setupPrompt"],
            "promptSource": "local-helper-codex",
            "account": {},
            "setupPlan": {"items": []}
        },
        "preDemoIntelligence": STATE["preDemoIntelligence"],
        "intelligence": STATE["demoIntelligence"],
        "operator": {"sessionTitle": "Local Helper Codex run", "cachedAt": STATE["lastGeneratedAt"]},
        "error": result.get("error") if not result.get("ok") else None,
        "code": result.get("code") if not result.get("ok") else None
    }


def simple_prompt(body, label):
    schema = {"title": label, "prompt": "usable prompt/content in markdown", "notes": ["list"]}
    result = codex_json_task(f"Create {label} for the demo context.", schema, body)
    data = result.get("json") if result.get("ok") else {}
    if not isinstance(data, dict):
        data = {}
    return {
        "ok": True,
        "source": "local-helper-codex",
        "title": data.get("title") or label,
        "prompt": data.get("prompt") or result.get("text") or "",
        "notes": data.get("notes") or [],
        "error": result.get("error") if not result.get("ok") else None,
        "code": result.get("code") if not result.get("ok") else None
    }


def manifest_payload():
    return {
        "ok": True,
        "featureFlags": {"liveDemoFunctionality": False},
        "appVersion": "local-helper-prototype",
        "buildMetadata": {"version": "local-helper-prototype", "environment": "local-helper", "profile": "mvp"},
        "manifest": {"title": "NS DemoHelper Local Helper", "segments": [], "context": {}, "defaults": {}},
        "versions": [],
        "guide": STATE["guide"],
        "guideOutputs": {
            "scRunbook": STATE["scRunbook"],
            "assetGenerationPrompt": STATE["assetGenerationPrompt"],
            "dryRunCreationPrompt": STATE["dryRunCreationPrompt"],
            "liveDemoFunctionality": False
        },
        "setupPrompt": {"prompt": STATE["setupPrompt"], "account": {}, "setupPlan": {"items": []}},
        "preDemoIntelligence": STATE["preDemoIntelligence"],
        "intelligence": STATE["demoIntelligence"]
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "NSDemoHelperLocalHelper/0.1"

    def end_headers(self):
        origin = allowed_origin(self.headers.get("Origin", ""))
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-demo-helper-session-id, x-demo-helper-anonymous-user-id, x-demo-helper-admin-session")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def json_response(self, payload, status=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/helper/status"):
            return self.json_response({
                "ok": True,
                "helper": {"name": "NS DemoHelper Local Helper", "mode": "local-helper", "port": PORT},
                "runtime": {"environment": "local-helper", "profile": "mvp"},
                "message": "Local helper is running."
            })
        if self.path.startswith("/api/platform/status"):
            return self.json_response({
                "ok": True,
                "runtime": {"environment": "local-helper", "profile": "mvp", "appVersion": "local-helper-prototype"},
                "provider": {"active": "Codex", "mode": "Local Helper"}
            })
        if self.path.startswith("/api/codex/status"):
            return self.json_response(codex_status())
        if self.path.startswith("/api/manifest"):
            return self.json_response(manifest_payload())
        if self.path.startswith("/api/sc-guide"):
            return self.json_response({"ok": True, "guide": STATE["guide"], "guideOutputs": manifest_payload()["guideOutputs"]})
        if self.path.startswith("/api/setup-prompt"):
            return self.json_response({"ok": True, "setupPrompt": manifest_payload()["setupPrompt"]})
        return self.json_response({"ok": False, "error": "Unknown helper endpoint.", "code": "HELPER_INVALID_RESPONSE"}, 404)

    def do_POST(self):
        body = self.read_json()
        if self.path.startswith("/api/pre-demo-score") or self.path.startswith("/api/pre-demo-intelligence"):
            return self.json_response(pre_demo_score(body))
        if self.path.startswith("/api/demo-runbook") or self.path.startswith("/api/learn"):
            return self.json_response(demo_runbook(body))
        if self.path.startswith("/api/ppt-prompt"):
            return self.json_response(simple_prompt(body, "Demo asset / PowerPoint prompt"))
        if self.path.startswith("/api/dataset-enhancement") or self.path.startswith("/api/dataset-analysis"):
            return self.json_response(simple_prompt(body, "Dataset enhancement prompt"))
        if self.path.startswith("/api/generate"):
            return self.json_response(simple_prompt(body, "General generation output"))
        if self.path.startswith("/api/codex/stop"):
            return self.json_response({"ok": True, "message": "No active helper request to stop."})
        return self.json_response({"ok": False, "error": "Unknown helper endpoint.", "code": "HELPER_INVALID_RESPONSE"}, 404)


def main():
    status = codex_status()
    print("NS DemoHelper Local Helper")
    print(f"Listening on http://127.0.0.1:{PORT}")
    print(f"APEX origin allowed: {APEX_ORIGIN}")
    print("Codex status:", status.get("message"))
    print("Keep this window open while using the APEX app. Press Ctrl+C to stop.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHelper stopped.")


if __name__ == "__main__":
    main()
PY_HELPER

chmod 700 "$HELPER_FILE"
echo "Starting NS DemoHelper Local Helper on http://127.0.0.1:${PORT}"
echo "Keep this window open while using the APEX app."
NSDH_HELPER_PORT="$PORT" NSDH_APEX_ORIGIN="$APEX_ORIGIN" /usr/bin/python3 "$HELPER_FILE"
