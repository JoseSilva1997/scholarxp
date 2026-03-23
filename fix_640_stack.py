import os

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_MEDIA = """  /* Side-by-side buttons on small screens to avoid a tall button stack */
  .actionStack {
    flex-direction: row;
    width: 100%;
  }"""

NEW_MEDIA = """  /* Side-by-side buttons on small screens to avoid a tall button stack */
  .actionStack {
    width: 100%;
  }"""

css = css.replace(OLD_MEDIA, NEW_MEDIA)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
