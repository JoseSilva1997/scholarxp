import re

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_TABLET_META = """  .titleSection {
    flex: 1 1 100%; /* Take up the entire first row or whatever it is allowed */
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }"""

NEW_TABLET_META = """  .titleSection {
    flex: 1 1 0; /* Share the first row with actions */
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }"""

css = css.replace(OLD_TABLET_META, NEW_TABLET_META)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
