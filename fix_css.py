import re

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

# 1. Update .meta to .titleSection and plain .meta
OLD_META = """.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 0 1 auto; /* Allow it to grow but fit content, and shrink if needed */
  border-right: 1px solid var(--color-border-subtle);
  padding-right: 24px;
}"""

NEW_META = """.titleSection {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 32px;
  flex: 1 1 0;
  border-right: 1px solid var(--color-border-subtle);
  padding-right: 24px;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1 1 0; /* Let it grow text freely */
}"""

css = css.replace(OLD_META, NEW_META)

# 2. Add flex: 1 to .header if we want? Wait, header already has flex. We want .titleSection.
# In tablet/mobile:
OLD_TABLET_META = """  /* Allow meta to grow and fill the first row alongside icon and actions */
  .meta {
    flex: 1 1 0;
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
  }"""

NEW_TABLET_META = """  .titleSection {
    flex: 1 1 100%; /* Take up the entire first row or whatever it is allowed */
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }"""

css = css.replace(OLD_TABLET_META, NEW_TABLET_META)

# 3. Mobile screen:
OLD_MOBILE_META = """  /* Adjust padding under meta for tiny screens */
  .meta {
    padding-bottom: 12px;
  }"""

NEW_MOBILE_META = """  /* Adjust padding and gap under meta for tiny screens */
  .titleSection {
    padding-bottom: 12px;
    gap: 12px;
  }"""

css = css.replace(OLD_MOBILE_META, NEW_MOBILE_META)


with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
