"""LAN printer discovery via mDNS (avahi) + port-9100 scan (nmap).

Returns a deduped list of candidates: { ip, name, source }.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from typing import Iterable


def _avahi() -> list[dict]:
    if shutil.which("avahi-browse") is None:
        return []
    try:
        r = subprocess.run(
            ["avahi-browse", "-artp", "--no-db-lookup"],
            capture_output=True, text=True, timeout=8,
        )
    except Exception:
        return []
    out: list[dict] = []
    for line in r.stdout.splitlines():
        # =;iface;IPv4;<name>;_ipp._tcp;local;<host>;<ip>;<port>;<txt>
        if not line.startswith("="):
            continue
        parts = line.split(";")
        if len(parts) < 9:
            continue
        if parts[2] != "IPv4":
            continue
        svc = parts[4]
        if svc not in ("_ipp._tcp", "_printer._tcp", "_pdl-datastream._tcp"):
            continue
        name = parts[3].replace("\\032", " ").strip()
        ip = parts[7].strip()
        if ip:
            out.append({"ip": ip, "name": name or "printer", "source": "mdns"})
    return out


def _nmap(subnet: str) -> list[dict]:
    if shutil.which("nmap") is None:
        return []
    try:
        r = subprocess.run(
            ["nmap", "-p", "9100", "--open", "-T4", "-n", subnet],
            capture_output=True, text=True, timeout=60,
        )
    except Exception:
        return []
    out: list[dict] = []
    current_ip: str | None = None
    for line in r.stdout.splitlines():
        m = re.match(r"Nmap scan report for (\S+)", line)
        if m:
            current_ip = m.group(1)
            continue
        if current_ip and "9100/tcp" in line and "open" in line:
            out.append({"ip": current_ip, "name": "raw-9100 device", "source": "nmap"})
            current_ip = None
    return out


def _default_subnet() -> str:
    """Guess /24 from default route. Falls back to a common AP subnet."""
    try:
        r = subprocess.run(["ip", "-4", "route", "get", "1.1.1.1"],
                           capture_output=True, text=True, timeout=2)
        m = re.search(r"src (\d+\.\d+\.\d+)\.\d+", r.stdout)
        if m:
            return f"{m.group(1)}.0/24"
    except Exception:
        pass
    return "10.42.0.0/24"


def discover(subnet: str | None = None) -> list[dict]:
    subnet = subnet or _default_subnet()
    found: list[dict] = []
    seen: set[str] = set()
    for item in (*_avahi(), *_nmap(subnet)):
        if item["ip"] in seen:
            continue
        seen.add(item["ip"])
        found.append(item)
    return found


def install_hp(ip: str) -> tuple[bool, str]:
    """Run hp-setup -i -a <ip>. Returns (ok, log)."""
    if shutil.which("hp-setup") is None:
        return False, "hp-setup not installed (apt install hplip)"
    try:
        r = subprocess.run(
            ["hp-setup", "-i", "-a", "-x", ip],
            capture_output=True, text=True, timeout=60,
        )
        return r.returncode == 0, (r.stdout + r.stderr)[-4000:]
    except Exception as e:
        return False, str(e)


def lpstat_printers() -> list[str]:
    if shutil.which("lpstat") is None:
        return []
    try:
        r = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=5)
    except Exception:
        return []
    names: list[str] = []
    for line in r.stdout.splitlines():
        m = re.match(r"printer (\S+)", line)
        if m:
            names.append(m.group(1))
    return names


def usb_devices() -> list[dict]:
    """List USB printers visible to CUPS via `lpinfo -v`.

    Returns rows like { uri, make_model }. Used by the USB setup wizard.
    """
    if shutil.which("lpinfo") is None:
        return []
    try:
        r = subprocess.run(
            ["lpinfo", "-l", "-v"], capture_output=True, text=True, timeout=6,
        )
    except Exception:
        return []
    out: list[dict] = []
    cur: dict = {}
    for raw in r.stdout.splitlines():
        line = raw.strip()
        if line.startswith("Device:"):
            if cur.get("uri", "").startswith("usb://"):
                out.append(cur)
            cur = {}
        elif line.startswith("uri = "):
            cur["uri"] = line[len("uri = "):].strip()
        elif line.startswith("make-and-model = "):
            cur["make_model"] = line[len("make-and-model = "):].strip()
    if cur.get("uri", "").startswith("usb://"):
        out.append(cur)
    return out


def install_usb(uri: str, name: str) -> tuple[bool, str]:
    """Install a USB printer in CUPS via lpadmin with the everywhere model."""
    if shutil.which("lpadmin") is None:
        return False, "lpadmin not installed (apt install cups-client)"
    try:
        r = subprocess.run(
            ["sudo", "-n", "lpadmin", "-p", name, "-E", "-v", uri, "-m", "everywhere"],
            capture_output=True, text=True, timeout=30,
        )
        log = (r.stdout + r.stderr)[-2000:]
        if r.returncode != 0:
            return False, log or "lpadmin failed"
        # Enable + accept jobs (idempotent).
        subprocess.run(["sudo", "-n", "cupsenable", name], capture_output=True, timeout=5)
        subprocess.run(["sudo", "-n", "cupsaccept", name], capture_output=True, timeout=5)
        return True, log
    except Exception as e:
        return False, str(e)

