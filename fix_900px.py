import re

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_MEDIA = """/* Tablet: wrap XP section to a second row so icon+title+buttons stay together on row 1 */
@media (max-width: 900px) {
  .header {
    flex-wrap: wrap;
    gap: 16px 20px;
  }

  .titleSection {
    flex: 1 1 0; /* Share the first row with actions */
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }

  /* Reorder actions before middleMeta so they sit on row 1 with the icon and title */
  .actions {
    order: 3;
  }

  .middleMeta {
    order: 4;
    flex: 0 0 100%;
    min-height: auto;
  }
}"""

NEW_MEDIA = """/* Tablet: title on top row, XP and actions on second row */
@media (max-width: 900px) {
  .header {
    flex-wrap: wrap;
    gap: 16px 20px;
  }

  .titleSection {
    flex: 0 0 100%; /* Take the full first row */
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-right: 0;
    padding-bottom: 14px;
    gap: 20px;
  }

  .middleMeta {
    /* Natural order puts this on the second row */
    flex: 1 1 0; /* Gush next to the actions */
    min-height: auto;
  }
  
  .actions {
    /* Naturally falls to the right of middleMeta */
    flex: 0 0 auto;
  }
}"""

css = css.replace(OLD_MEDIA, NEW_MEDIA)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
