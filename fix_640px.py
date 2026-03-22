import re

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_640_META = """  /* Reset order so XP section renders above actions (natural DOM order) */
  .middleMeta {
    order: 0;
  }

  /* Actions drop to their own full-width row below XP */
  .actions {
    order: 0;
    flex: 0 0 100%;
    padding-right: 0;
    margin-left: 0;
  }"""

NEW_640_META = """  /* Actions drop to their own full-width row below XP */
  .actions {
    flex: 0 0 100%;
    padding-right: 0;
    margin-left: 0;
  }"""

css = css.replace(OLD_640_META, NEW_640_META)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
