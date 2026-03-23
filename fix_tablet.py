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
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }

  .header {
    border-bottom: none; /* Make sure we don't have existing borders if any */
  }
  
  /* Wait, if the user wants the border on the title container to span the whole width, the title container must span the whole width */"""

css = css.replace(OLD_TABLET_META, NEW_TABLET_META)

