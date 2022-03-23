# Obsidian simple mention
A simple plugin that visually highlights mentions and suggests existing ones as you write.
The mention prefix can be customized and defaults to `@`.
Find all occurrences of a mention in the side pane and jump to the corresponding line in the document.
Distinguish your personal mentions from the others by a different color.

## Settings
You can set:
- the triggerphrase (@)
- the color of the mentions (green)
- the color of your own mentions (deeppink)
- the name, how you want to mention yourself (Me)

## Shortcuts
### In edit mode
`ctrl+space` or `ctrl+click` will trigger the search with the underlying mention.

### In preview mode
Click on a mention triggers a search of this mention.

## Known issues
- We need to restart Obsidian after adjusting the trigger phrase for the changes to take effect.
- We need to restart Obsidian after changing the name of yourself for the changes to take effect.
- Style could currently not be overridden by a template (simple fix)
- Sometimes preview search click does not work --> Workaround: reopen docment 

## Ideas
- Group mentions
  - eg. @group-x(@bob,@lisa)
  - usage: find all mentions of @bob and @lisa by searching for @group-x
- Multi select of mentions in the view
- Mark filterphrase in the view
- Show sub bullet points
- own color for each "person"