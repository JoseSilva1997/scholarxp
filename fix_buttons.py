import os

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'r') as f:
    css = f.read()

OLD_MEDIA = """  .actions {
    /* Naturally falls to the right of middleMeta */
    flex: 0 0 auto;
  }
}"""

NEW_MEDIA = """  .actions {
    /* Naturally falls to the right of middleMeta */
    flex: 0 0 auto;
  }

  .actionStack {
    flex-direction: row;
  }
}"""

css = css.replace(OLD_MEDIA, NEW_MEDIA)

with open('apps/frontend/src/components/StudentModuleUnitCard.module.css', 'w') as f:
    f.write(css)

print("Done")
