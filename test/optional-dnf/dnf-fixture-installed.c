/* Apache-2.0. Test-process-only shim: label a synthetic in-memory repository. */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef void Pool;
typedef void Repo;

/* Give the Python harness an explicit way to detect this fixture preload. */
int ovos_fixture_preload_active(void) {
    return 1;
}

/* Delegate repository creation, then label only our named fixture installed. */
Repo *repo_create(Pool *pool, const char *name) {
    static void *handle;
    static Repo *(*original)(Pool *, const char *);
    static void (*set_installed)(Pool *, Repo *);
    if (!handle) {
        handle = dlopen("libsolv.so.1", RTLD_NOW | RTLD_LOCAL);
        if (!handle) {
            fprintf(stderr, "Fixture could not load libsolv: %s\n", dlerror());
            abort();
        }
        original = (Repo *(*)(Pool *, const char *))dlsym(handle, "repo_create");
        set_installed = (void (*)(Pool *, Repo *))dlsym(handle, "pool_set_installed");
        if (!original || !set_installed) {
            fputs("Fixture requires repo_create and pool_set_installed\n", stderr);
            abort();
        }
    }
    Repo *repo = original(pool, name);
    if (repo && name && strcmp(name, "ovos-installed-fixture") == 0) {
        set_installed(pool, repo);
    }
    return repo;
}
