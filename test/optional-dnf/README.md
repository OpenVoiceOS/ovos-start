# Optional DNF solver tests

`TestRichDependency` in [solver_cases.py](solver_cases.py) tests the dependency expression `(curl or curl-minimal)` against five synthetic package sets in both DNF4 and DNF5. It verifies that an installed variant is retained, or one available variant is selected when neither is installed. Every case requires zero removals. The fake `curl-minimal` package provides `curl` and conflicts with it.

These are dependency-solver tests, not full CLI or distribution integration tests. They do not inspect enabled repositories, download packages, load the host RPM database, or execute transactions. `resolve_dnf4()` calls `hawkey.Goal.run()` (solver only); `resolve_dnf5()` calls `libdnf5.base.Goal.resolve()`. They never call DNF4 `Base.do_transaction()` or DNF5 `Transaction.run()`. All cache, log, persistence, and installroot paths use temporary directories.

Prerequisites already present on the test machine: Linux, a C compiler, `libsolv.so.1`, libsolvext, libdnf, and system Python bindings for `dnf`, `hawkey`, and `libdnf5`. No package installation is part of this harness. Use the system Python with these bindings, not an unrelated virtual environment. The DNF4 fixture uses the private `PyObject_HEAD`/sack layout from libdnf's `python/hawkey/sack-py.cpp`; it requires regular GIL-enabled CPython and may need adaptation for future libdnf ABI changes.

Run from the workspace root:

```sh
/usr/bin/python3 ovos-start/test/optional-dnf/run_solver_tests.py
```

`main()` in [run_solver_tests.py](run_solver_tests.py) compiles the shim with `cc -std=c11 -Wall -Wextra -Werror -shared -fPIC ... -ldl` into a Python `TemporaryDirectory`, then invokes this same Python interpreter with `-m unittest discover -s <fixture-directory> -p solver_cases.py -v`. It sets `LD_PRELOAD` only for that child process and disables Python optimization so assertions remain active. The temporary library is automatically deleted after the test command.

`repo_create()` in [dnf-fixture-installed.c](dnf-fixture-installed.c) labels the synthetic `ovos-installed-fixture` repository as installed within libsolv memory. It does not write an RPM database.

Expected result with all prerequisites: `Ran 2 tests`, `OK`, with no skips. Each test has five subcases (ten solver scenarios total). Missing optional bindings or a missing DNF5 preload produce explicit skips; a skipped engine is not evidence that engine passed.

Verified on 2026-10-08: CPython 3.14.8, DNF4 4.24.0, libdnf 0.76.0, libdnf5 5.4.6.0, libsolv 0.7.40. See [verification.txt](verification.txt) for the run output. Distribution package metadata, older solver versions, repository policy, and network behavior are outside these fixtures.
