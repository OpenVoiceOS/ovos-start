"""Solve synthetic DNF4/DNF5 fixtures without downloads or RPM transactions.

The only goal is ``(curl or curl-minimal)``. No host repositories or RPM database
are loaded. All writable paths belong to a disposable temporary directory.
"""

from __future__ import annotations

import ctypes
import ctypes.util
from dataclasses import dataclass
from pathlib import Path
import sys
import sysconfig
import tempfile
from typing import Any, Callable
import unittest


@dataclass(frozen=True)
class Case:
    """Installed and available names in one synthetic package universe."""

    label: str
    installed: tuple[str, ...]
    available: tuple[str, ...]


CASES = (
    Case(
        "minimal installed, both offered",
        ("curl-minimal",),
        ("curl", "curl-minimal"),
    ),
    Case("full installed, both offered", ("curl",), ("curl", "curl-minimal")),
    Case("no curl, full available", (), ("curl",)),
    Case("no curl, minimal available", (), ("curl-minimal",)),
    Case("no curl, both available", (), ("curl", "curl-minimal")),
)


def tags(names: tuple[str, ...]) -> str:
    """Create libsolv testtags; curl-minimal provides and conflicts with curl."""
    lines: list[str] = []
    for name in names:
        lines.extend((f"=Pkg: {name} 1 1 noarch", f"=Prv: {name} = 1-1"))
        if name == "curl-minimal":
            lines.extend(("=Prv: curl = 1-1", "=Con: curl"))
    return "\n".join(lines) + "\n"


def bind(library: Any, name: str, result: Any, args: list[Any]) -> Any:
    """Declare a native function's ABI before calling it through ctypes."""
    function = getattr(library, name)
    function.restype = result
    function.argtypes = args
    return function


class PySack(ctypes.Structure):
    """CPython PyObject_HEAD and sack pointer from libdnf's sack-py.cpp."""

    _fields_ = [
        ("refcnt", ctypes.c_ssize_t),
        ("type", ctypes.c_void_p),
        ("sack", ctypes.c_void_p),
    ]


def resolve_dnf4(case: Case) -> tuple[list[str], list[str]]:
    """Run hawkey's dependency solver only; never call do_transaction()."""
    import dnf
    import hawkey

    void = ctypes.c_void_p
    libdnf = ctypes.CDLL(ctypes.util.find_library("dnf"))
    libsolv = ctypes.CDLL(ctypes.util.find_library("solv"))
    libext = ctypes.CDLL(ctypes.util.find_library("solvext"))
    libc = ctypes.CDLL(None)
    get_pool = bind(libdnf, "dnf_sack_get_pool", void, [void])
    create = bind(libsolv, "repo_create", void, [void, ctypes.c_char_p])
    set_installed = bind(libsolv, "pool_set_installed", None, [void, void])
    add_tags = bind(
        libext,
        "testcase_add_testtags",
        ctypes.c_int,
        [void, void, ctypes.c_int],
    )
    fopen = bind(libc, "fopen", void, [ctypes.c_char_p, ctypes.c_char_p])
    fclose = bind(libc, "fclose", ctypes.c_int, [void])
    with tempfile.TemporaryDirectory(prefix="ovos-dnf4-solver-") as temp:
        with dnf.Base() as context:
            for option in ("installroot", "cachedir", "persistdir", "logdir"):
                setattr(context.conf, option, temp)
            context.conf.multilib_policy = "best"
            context._sack = dnf.sack.Sack(
                cachedir=temp, arch="x86_64", make_cache_dir=True
            )
            pool = get_pool(PySack.from_address(id(context.sack)).sack)
            assert pool, "DNF4 did not expose its libsolv pool"
            for name, names in (
                ("@System", case.installed),
                ("available", case.available),
            ):
                path = Path(temp, name + ".repo")
                path.write_text(tags(names), encoding="utf-8")
                repository = create(pool, name.encode())
                stream = fopen(bytes(path), b"r")
                assert (
                    repository and stream
                ), "Could not create synthetic repository"
                try:
                    assert add_tags(repository, stream, 0) == 0
                finally:
                    fclose(stream)
                if name == "@System":
                    set_installed(pool, repository)
            actual = sorted(
                package.name for package in context.sack.query().installed()
            )
            assert actual == sorted(case.installed), actual
            context._goal = hawkey.Goal(context.sack)
            context.install(
                "(curl or curl-minimal)"
            )  # Adds a solver request only.
            assert context._goal.run(), context._goal.problem_rules()
            return (
                sorted(
                    package.name for package in context._goal.list_installs()
                ),
                sorted(
                    package.name for package in context._goal.list_erasures()
                ),
            )


def resolve_dnf5(case: Case) -> tuple[list[str], list[str]]:
    """Resolve the goal only; never call Transaction.run() or download()."""
    from libdnf5 import base, rpm, transaction

    with tempfile.TemporaryDirectory(prefix="ovos-dnf5-solver-") as temp:
        context = base.Base()
        config = context.get_config()
        for option in (
            "installroot",
            "cachedir",
            "system_cachedir",
            "persistdir",
            "logdir",
        ):
            getattr(config, f"get_{option}_option")().set(temp)
        context.get_vars().set("arch", "x86_64")
        context.setup()
        for name, names in (
            ("ovos-installed-fixture", case.installed),
            ("available", case.available),
        ):
            path = Path(temp, name + ".repo")
            path.write_text(tags(names), encoding="utf-8")
            context.get_repo_sack().create_repo_from_libsolv_testcase(
                name, str(path)
            )
        installed = rpm.PackageQuery(context)
        installed.filter_installed()
        assert sorted(package.get_name() for package in installed) == sorted(
            case.installed
        )
        goal = base.Goal(context)
        goal.add_rpm_install("(curl or curl-minimal)")
        result = goal.resolve()
        assert (
            result.get_problems() == base.GoalProblem_NO_PROBLEM
        ), result.get_resolve_logs_as_strings()
        changes = [
            (item.get_package().get_name(), item.get_action())
            for item in result.get_transaction_packages()
        ]
        added = sorted(
            name
            for name, action in changes
            if action == transaction.TransactionItemAction_INSTALL
        )
        removed = sorted(
            name
            for name, action in changes
            if action == transaction.TransactionItemAction_REMOVE
        )
        assert len(changes) == len(added) + len(removed), changes
        return added, removed


class TestRichDependency(unittest.TestCase):
    """Verify each solver preserves either installed variant or installs one."""

    def check_matrix(
        self, resolver: Callable[[Case], tuple[list[str], list[str]]]
    ) -> None:
        """Require no removals, no redundant installs, and an available provider."""
        for case in CASES:
            with self.subTest(case=case.label):
                added, removed = resolver(case)
                self.assertEqual(removed, [])
                if case.installed:
                    self.assertEqual(added, [])
                else:
                    self.assertEqual(len(added), 1)
                    self.assertIn(added[0], case.available)

    def test_dnf4(self) -> None:
        """Exercise five cases with DNF4's hawkey solver."""
        if (
            sys.implementation.name != "cpython"
            or sysconfig.get_config_var("Py_GIL_DISABLED")
            or hasattr(sys, "getobjects")
        ):
            self.skipTest(
                "DNF4 fixture requires a regular GIL-enabled CPython build"
            )
        try:
            import dnf  # noqa: F401
            import hawkey  # noqa: F401
        except ImportError as error:
            self.skipTest(
                f"Optional DNF4 Python bindings unavailable: {error}"
            )
        self.check_matrix(resolve_dnf4)

    def test_dnf5(self) -> None:
        """Exercise five cases with DNF5 and the process-local fixture shim."""
        try:
            import libdnf5  # noqa: F401
        except ImportError as error:
            self.skipTest(
                f"Optional DNF5 Python bindings unavailable: {error}"
            )
        if not hasattr(ctypes.CDLL(None), "ovos_fixture_preload_active"):
            self.skipTest(
                "DNF5 requires the supplied LD_PRELOAD fixture; see README.md"
            )
        self.check_matrix(resolve_dnf5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
