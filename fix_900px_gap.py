import os

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_MEDIA = """  .actionStack {
    flex-direction: row;
  }"""

NEW_MEDIA = """  .actionStack {
    flex-direction: row;
    gap: 12px; /* Add some nice horizontal spacing so they don't look awkwardly packed */
  }"""

css = css.replace(OLD_MEDIA, NEW_MEDIA)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
