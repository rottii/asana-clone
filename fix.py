import codecs

path = 'frontend/src/components/ProjectListView.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'â‹®â‹®': '⋮⋮',
    'âœ ï¸ ': '✏️',
    'âœ•': '✕',
    'ğŸ‘¥': '👥',
    'âŠ–': '⊖',
    'â†‘': '↑',
    'â†“': '↓',
    'â–¼': '▼',
    'â–¶': '▶',
    'â†³': '↳',
    'ğŸ“…': '📅',
    'ğŸ‘¤': '👤',
    'ğŸ”—': '🔗',
    'Æ’': 'ƒ',
    'ğŸ†”': '🆔',
    'â ±ï¸ ': '⏱️',
    'ğŸ” ': '🔍',
    'âœ…': '✅'
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
